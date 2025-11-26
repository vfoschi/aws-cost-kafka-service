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
  granularity: process.env.GRANULARITY || 'DAILY',
  groupBy: process.env.GROUP_BY || 'SERVICE',
  // Configurazione campi NETMON
  netmon: {
    ip: process.env.NETMON_IP || '0.0.0.0',
    vlan: process.env.NETMON_VLAN || 'AWS',
    sim: process.env.NETMON_SIM || '000000000000',
    dir: parseInt(process.env.NETMON_DIR || '0')
  }
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
  retry: { initialRetryTime: 100, retries: 8 }
};

if (config.kafka.username && config.kafka.password) {
  kafkaConfig.sasl = {
    mechanism: 'plain',
    username: config.kafka.username,
    password: config.kafka.password
  };
}

if (config.kafka.ssl) {
  kafkaConfig.ssl = true;
}

const kafka = new Kafka(kafkaConfig);
const producer = kafka.producer();

/**
 * Mappa i servizi AWS a codici L7_PROTO
 * Estendere questa mappa per aggiungere nuovi servizi
 */
const SERVICE_PROTO_MAP = {
  'Amazon Elastic Compute Cloud - Compute': { proto: '100', name: 'AWS_EC2', category: 'Compute' },
  'Amazon EC2': { proto: '100', name: 'AWS_EC2', category: 'Compute' },
  'Amazon Simple Storage Service': { proto: '101', name: 'AWS_S3', category: 'Storage' },
  'Amazon S3': { proto: '101', name: 'AWS_S3', category: 'Storage' },
  'Amazon Relational Database Service': { proto: '102', name: 'AWS_RDS', category: 'Database' },
  'Amazon RDS': { proto: '102', name: 'AWS_RDS', category: 'Database' },
  'Amazon DynamoDB': { proto: '103', name: 'AWS_DynamoDB', category: 'Database' },
  'AWS Lambda': { proto: '104', name: 'AWS_Lambda', category: 'Compute' },
  'Amazon CloudFront': { proto: '105', name: 'AWS_CloudFront', category: 'CDN' },
  'Amazon Elastic Container Service': { proto: '106', name: 'AWS_ECS', category: 'Compute' },
  'Amazon Elastic Kubernetes Service': { proto: '107', name: 'AWS_EKS', category: 'Compute' },
  'Amazon ElastiCache': { proto: '108', name: 'AWS_ElastiCache', category: 'Cache' },
  'Amazon Virtual Private Cloud': { proto: '109', name: 'AWS_VPC', category: 'Network' },
  'Amazon Route 53': { proto: '110', name: 'AWS_Route53', category: 'DNS' },
  'AWS Config': { proto: '111', name: 'AWS_Config', category: 'Management' },
  'Amazon CloudWatch': { proto: '112', name: 'AWS_CloudWatch', category: 'Monitoring' },
  'Amazon SNS': { proto: '113', name: 'AWS_SNS', category: 'Messaging' },
  'Amazon SQS': { proto: '114', name: 'AWS_SQS', category: 'Messaging' },
  'Amazon Kinesis': { proto: '115', name: 'AWS_Kinesis', category: 'Streaming' },
  'AWS Key Management Service': { proto: '116', name: 'AWS_KMS', category: 'Security' },
  'DEFAULT': { proto: '199', name: 'AWS_OTHER', category: 'Other' }
};

/**
 * Ottiene i dati del protocollo per un servizio AWS
 */
function getServiceProto(serviceName) {
  return SERVICE_PROTO_MAP[serviceName] || SERVICE_PROTO_MAP['DEFAULT'];
}

function getDateRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - config.lookbackDays);
  
  const startDate = start.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];
  
  return { startDate, endDate };
}

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
    
    return response;
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching AWS costs');
    throw error;
  }
}

/**
 * Trasforma i dati AWS in formato NETMON per Kafka
 * Formato richiesto:
 * {
 *   "_L7_PROTO": "91",
 *   "_L7_PROTO_NAME": "TLS",
 *   "_L7_PROTO_CATEGORY": "Web",
 *   "_IP": "10.8.193.94",
 *   "_VLAN": "TEAMSYSTEM",
 *   "_DIR": 0,
 *   "_SIM": "393488628060",
 *   "_DATE": 1763868576,
 *   "_BYTES": 41
 * }
 */
function transformCostData(awsResponse) {
  const messages = [];
  
  awsResponse.ResultsByTime.forEach(period => {
    const periodStart = period.TimePeriod.Start;
    const periodEnd = period.TimePeriod.End;
    
    // Converti la data in timestamp Unix
    const dateTimestamp = Math.floor(new Date(periodStart).getTime() / 1000);
    
    period.Groups.forEach(group => {
      const serviceName = group.Keys[0];
      const costAmount = parseFloat(group.Metrics.UnblendedCost.Amount);
      
      // Ottieni i dati del protocollo per il servizio
      const serviceProto = getServiceProto(serviceName);
      
      // Converti il costo in formato richiesto (moltiplicato per 100, senza decimali)
      const costBytes = Math.round(costAmount * 100);
      
      // Crea il messaggio in formato NETMON
      const message = {
        _L7_PROTO: serviceProto.proto,
        _L7_PROTO_NAME: serviceProto.name,
        _L7_PROTO_CATEGORY: serviceProto.category,
        _IP: config.netmon.ip,
        _VLAN: config.netmon.vlan,
        _DIR: config.netmon.dir,
        _SIM: config.netmon.sim,
        _DATE: dateTimestamp,
        _BYTES: costBytes
      };
      
      messages.push({
        key: `${serviceName}-${periodStart}`,
        value: JSON.stringify(message)
      });
      
      logger.debug({
        service: serviceName,
        cost: costAmount,
        bytes: costBytes,
        proto: serviceProto.proto,
        protoName: serviceProto.name
      }, 'Transformed cost data');
    });
  });
  
  return messages;
}

async function publishToKafka(messages) {
  try {
    if (messages.length === 0) {
      logger.warn('No messages to publish');
      return;
    }

    logger.info({ count: messages.length, topic: config.kafka.topic }, 'Publishing messages to Kafka');
    
    const result = await producer.send({
      topic: config.kafka.topic,
      messages: messages
    });
    
    logger.info({ 
      topic: config.kafka.topic,
      messagesPublished: messages.length,
      partitions: result.length
    }, 'Messages published successfully');
    
    return result;
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error publishing to Kafka');
    throw error;
  }
}

async function processCosts() {
  try {
    logger.info('Starting cost processing cycle');
    
    const awsResponse = await fetchAWSCosts();
    
    if (!awsResponse) {
      logger.warn('No data to process');
      return;
    }
    
    const messages = transformCostData(awsResponse);
    
    await publishToKafka(messages);
    
    logger.info('Cost processing cycle completed successfully');
  } catch (error) {
    logger.error({ error: error.message }, 'Error in cost processing cycle');
  }
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');
  
  try {
    await producer.disconnect();
    logger.info('Kafka producer disconnected');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error.message }, 'Error during shutdown');
    process.exit(1);
  }
}

async function start() {
  try {
    logger.info({
      config: {
        kafka: {
          brokers: config.kafka.brokers,
          topic: config.kafka.topic,
          clientId: config.kafka.clientId,
          ssl: config.kafka.ssl,
          sasl: !!config.kafka.username
        },
        aws: {
          region: config.aws.region,
          hasCredentials: !!(config.aws.accessKeyId && config.aws.secretAccessKey)
        },
        netmon: config.netmon,
        interval: `${config.interval / 1000}s`,
        lookbackDays: config.lookbackDays,
        granularity: config.granularity,
        groupBy: config.groupBy
      }
    }, 'Starting AWS Cost Kafka Service');
    
    await producer.connect();
    logger.info('Kafka producer connected');
    
    await processCosts();
    
    const intervalId = setInterval(processCosts, config.interval);
    logger.info({ intervalMinutes: config.interval / 60000 }, 'Scheduled interval set');
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('exit', () => {
      clearInterval(intervalId);
    });
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to start service');
    process.exit(1);
  }
}

start();
