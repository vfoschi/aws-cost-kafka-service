const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { Kafka } = require('kafkajs');
const pino = require('pino');

// Configurazione logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: false,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Configurazione da variabili d'ambiente
const config = {
  aws: {
    region: process.env.AWS_REGION || 'eu-west-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'aws-cost-service',
    topic: process.env.KAFKA_TOPIC || 'aws-costs',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
    ssl: process.env.KAFKA_SSL === 'true'
  },
  interval: parseInt(process.env.FETCH_INTERVAL_MINUTES || '60') * 60 * 1000,
  lookbackDays: parseInt(process.env.LOOKBACK_DAYS || '1'),
  granularity: process.env.GRANULARITY || 'DAILY', // DAILY, MONTHLY, HOURLY
  groupBy: process.env.GROUP_BY || 'SERVICE' // SERVICE, LINKED_ACCOUNT, TAG, etc.
};

// Client AWS Cost Explorer
const costExplorerClient = new CostExplorerClient({
  region: config.aws.region,
  credentials: config.aws.accessKeyId && config.aws.secretAccessKey ? {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey
  } : undefined
});

// Client Kafka
const kafkaConfig = {
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
};

// Aggiungi SASL se credenziali sono fornite
if (config.kafka.username && config.kafka.password) {
  kafkaConfig.sasl = {
    mechanism: 'plain',
    username: config.kafka.username,
    password: config.kafka.password
  };
}

// Aggiungi SSL se richiesto
if (config.kafka.ssl) {
  kafkaConfig.ssl = true;
}

const kafka = new Kafka(kafkaConfig);
const producer = kafka.producer();

/**
 * Calcola le date per la query dei costi
 */
function getDateRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - config.lookbackDays);
  
  // Formato richiesto da AWS: YYYY-MM-DD
  const startDate = start.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];
  
  return { startDate, endDate };
}

/**
 * Recupera i costi da AWS Cost Explorer
 */
async function fetchAWSCosts() {
  try {
    const { startDate, endDate } = getDateRange();
    
    logger.info({ startDate, endDate, granularity: config.granularity }, 'Fetching AWS costs');
    
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate
      },
      Granularity: config.granularity,
      Metrics: ['UnblendedCost', 'UsageQuantity'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: config.groupBy
        }
      ]
    });

    const response = await costExplorerClient.send(command);
    
    if (!response.ResultsByTime || response.ResultsByTime.length === 0) {
      logger.warn('No cost data returned from AWS');
      return null;
    }

    logger.info({ 
      periods: response.ResultsByTime.length,
      totalGroups: response.ResultsByTime.reduce((sum, period) => sum + (period.Groups?.length || 0), 0)
    }, 'AWS costs fetched successfully');
    
