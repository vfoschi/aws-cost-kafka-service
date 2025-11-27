// Test script per verificare il calcolo differenziale dei costi
// Esegui con: node test-differential-calculation.js

console.log('=== Test Calcolo Differenziale Costi AWS ===\n');

// Simula la cache in-memory
const costCache = new Map();

// Simula letture AWS successive
const awsReadings = [
  { time: '08:00', service: 'Amazon EC2', cost: 10.50 },
  { time: '08:05', service: 'Amazon EC2', cost: 10.75 },
  { time: '08:10', service: 'Amazon EC2', cost: 11.00 },
  { time: '08:15', service: 'Amazon EC2', cost: 11.00 },  // Nessun cambio
  { time: '08:20', service: 'Amazon EC2', cost: 11.50 },
  { time: '08:25', service: 'Amazon S3', cost: 5.23 },   // Nuovo servizio
  { time: '08:30', service: 'Amazon S3', cost: 5.48 },
  { time: '08:35', service: 'Amazon EC2', cost: 11.75 },
];

function processReading(reading) {
  const { time, service, cost } = reading;
  const cacheKey = `${service}-2024-11-27`;
  
  // Recupera costo precedente
  const previousCost = costCache.get(cacheKey) || 0;
  
  // Calcola differenza
  const difference = cost - previousCost;
  
  // Aggiorna cache
  costCache.set(cacheKey, cost);
  
  console.log(`[${time}] ${service}`);
  console.log(`  Current:  $${cost.toFixed(2)}`);
  console.log(`  Previous: $${previousCost.toFixed(2)}`);
  console.log(`  Diff:     $${difference.toFixed(2)}`);
  
  if (difference > 0) {
    const bytes = Math.round(difference * 100);
    console.log(`  → Kafka:  ${bytes} bytes`);
    console.log(`  → Message: {`);
    console.log(`      "_L7_PROTO": "100",`);
    console.log(`      "_L7_PROTO_NAME": "AWS_EC2",`);
    console.log(`      "_BYTES": ${bytes}`);
    console.log(`    }`);
  } else if (difference === 0) {
    console.log(`  → Skip (nessuna differenza)`);
  } else {
    console.log(`  → Skip (differenza negativa - credito AWS)`);
  }
  console.log('');
}

// Processa tutte le letture
awsReadings.forEach(processReading);

// Riepilogo finale
console.log('=== Riepilogo Cache ===');
costCache.forEach((cost, key) => {
  console.log(`${key}: $${cost.toFixed(2)}`);
});

console.log('\n=== Totale Messaggi Pubblicati ===');
let totalMessages = 0;
let totalBytes = 0;

awsReadings.forEach(reading => {
  const cacheKey = `${reading.service}-2024-11-27`;
  const previousValues = [];
  
  awsReadings.forEach(r => {
    if (r.service === reading.service && r.time <= reading.time) {
      previousValues.push(r.cost);
    }
  });
  
  if (previousValues.length > 0) {
    const prev = previousValues.length > 1 ? previousValues[previousValues.length - 2] : 0;
    const diff = reading.cost - prev;
    if (diff > 0) {
      totalMessages++;
      totalBytes += Math.round(diff * 100);
    }
  }
});

console.log(`Messaggi: ${totalMessages}`);
console.log(`Bytes totali: ${totalBytes}`);
console.log(`Costo totale: $${(totalBytes / 100).toFixed(2)}`);

console.log('\n=== Verifica Correttezza ===');
console.log(`EC2 finale: $${costCache.get('Amazon EC2-2024-11-27').toFixed(2)}`);
console.log(`S3 finale:  $${costCache.get('Amazon S3-2024-11-27').toFixed(2)}`);
console.log(`Totale:     $${(costCache.get('Amazon EC2-2024-11-27') + costCache.get('Amazon S3-2024-11-27')).toFixed(2)}`);
