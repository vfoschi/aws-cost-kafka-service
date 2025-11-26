// Script di test per verificare il formato NETMON dei messaggi
// Esegui con: node test-netmon-format.js

const sampleAWSResponse = {
  ResultsByTime: [
    {
      TimePeriod: {
        Start: "2024-01-14",
        End: "2024-01-15"
      },
      Groups: [
        {
          Keys: ["Amazon EC2"],
          Metrics: {
            UnblendedCost: {
              Amount: "123.45",
              Unit: "USD"
            },
            UsageQuantity: {
              Amount: "720.0",
              Unit: "Hrs"
            }
          }
        },
        {
          Keys: ["Amazon S3"],
          Metrics: {
            UnblendedCost: {
              Amount: "45.67",
              Unit: "USD"
            },
            UsageQuantity: {
              Amount: "1000.0",
              Unit: "GB-Mo"
            }
          }
        },
        {
          Keys: ["Amazon RDS"],
          Metrics: {
            UnblendedCost: {
              Amount: "234.56",
              Unit: "USD"
            },
            UsageQuantity: {
              Amount: "720.0",
              Unit: "Hrs"
            }
          }
        }
      ]
    }
  ]
};

const SERVICE_PROTO_MAP = {
  'Amazon EC2': { proto: '100', name: 'AWS_EC2', category: 'Compute' },
  'Amazon S3': { proto: '101', name: 'AWS_S3', category: 'Storage' },
  'Amazon RDS': { proto: '102', name: 'AWS_RDS', category: 'Database' },
  'DEFAULT': { proto: '199', name: 'AWS_OTHER', category: 'Other' }
};

const config = {
  netmon: {
    ip: '0.0.0.0',
    vlan: 'AWS',
    sim: '000000000000',
    dir: 0
  }
};

function getServiceProto(serviceName) {
  return SERVICE_PROTO_MAP[serviceName] || SERVICE_PROTO_MAP['DEFAULT'];
}

function transformCostData(awsResponse) {
  const messages = [];
  
  awsResponse.ResultsByTime.forEach(period => {
    const periodStart = period.TimePeriod.Start;
    const dateTimestamp = Math.floor(new Date(periodStart).getTime() / 1000);
    
    period.Groups.forEach(group => {
      const serviceName = group.Keys[0];
      const costAmount = parseFloat(group.Metrics.UnblendedCost.Amount);
      const serviceProto = getServiceProto(serviceName);
      const costBytes = Math.round(costAmount * 100);
      
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
        value: JSON.stringify(message, null, 2)
      });
    });
  });
  
  return messages;
}

console.log('=== Test AWS Cost to NETMON Format ===\n');

const messages = transformCostData(sampleAWSResponse);

messages.forEach((msg, index) => {
  console.log(`Message ${index + 1}:`);
  console.log(`Key: ${msg.key}`);
  console.log(`Value:\n${msg.value}`);
  console.log('---\n');
});

console.log(`Total messages: ${messages.length}`);

const totalCost = messages.reduce((sum, msg) => {
  const parsed = JSON.parse(msg.value);
  return sum + (parsed._BYTES / 100);
}, 0);

console.log(`Total cost: $${totalCost.toFixed(2)}`);
console.log(`Total bytes: ${messages.reduce((sum, msg) => {
  const parsed = JSON.parse(msg.value);
  return sum + parsed._BYTES;
}, 0)}`);
