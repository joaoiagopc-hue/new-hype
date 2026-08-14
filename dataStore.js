const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DATA_PATH)) {
    const start = Number(process.env.START_ID) || 10;
    const base = { nextId: start, users: {} };
    fs.writeFileSync(DATA_PATH, JSON.stringify(base, null, 2));
    return base;
  }
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler data.json:', err);
    const start = Number(process.env.START_ID) || 10;
    return { nextId: start, users: {} };
  }
}

function save(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro ao salvar data.json:', err);
  }
}

module.exports = { load, save };