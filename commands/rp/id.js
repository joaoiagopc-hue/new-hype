// id.js
// Comando !id — atribui/retorna ID (a partir de nextId em data.json) e atualiza nickname para "ID | user".
// EDITE o bloco CONFIG abaixo com os IDs se quiser (WL_ROLE_ID opcional).

const fs = require('fs');
const path = require('path');

const CONFIG = {
  DATA_FILE: path.join(__dirname, 'data.json'),
  WL_ROLE_ID: '1537933883788763177' // opcional: cargo "com id" que será aplicado quando atribuir ID
};

let client;

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

function loadData() {
  if (!fs.existsSync(CONFIG.DATA_FILE)) fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));
  try { return JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8') || '{}'); } catch { return { nextId: 10, applications: {}, ids: {} }; }
}
function saveData(data) { fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2)); }

function makeNickname(id, name) {
  const base = `${id} | ${name}`;
  if (base.length <= 32) return base;
  const idLen = String(id).length;
  const maxNameLen = 32 - (idLen + 3);
  return `${id} | ${name.slice(0, Math.max(0, maxNameLen))}`;
}

async function onIdCommand(message) {
  try {
    if (!message.guild) return message.reply({ content: 'Este comando só funciona em servidor.', ephemeral: true });
    const member = message.member;
    if (!member) return message.reply({ content: 'Não consegui obter seu membro no servidor.', ephemeral: true });

    const data = loadData();
    data.ids = data.ids || {};

    let assigned = data.ids[member.id];
    if (!assigned) {
      assigned = data.nextId || 10;
      data.nextId = Number(assigned) + 1;
      data.ids[member.id] = assigned;
      saveData(data);
    }

    // aplica cargo "com id" se configurado
    try {
      if (CONFIG.WL_ROLE_ID && CONFIG.WL_ROLE_ID !== 'COLE_AQUI_WL_ROLE_ID') {
        await member.roles.add(CONFIG.WL_ROLE_ID, 'Assigned via !id');
      }
    } catch (err) {
      console.error('Erro ao adicionar cargo WL_ROLE_ID via !id', err);
    }

    // atualiza nickname
    const newNick = makeNickname(assigned, member.nickname || member.user.username);
    try {
      if (member.manageable) await member.setNickname(newNick, 'Assigned via !id');
    } catch (err) {
      console.error('Erro ao setNickname via !id', err);
    }

    return message.reply({ content: `✅ Seu ID é **${assigned}** — nick: \`${newNick}\``, ephemeral: false });
  } catch (err) {
    console.error('onIdCommand error', err);
    return message.reply({ content: 'Erro ao processar seu ID.', ephemeral: true });
  }
}

module.exports = { setup, onIdCommand, CONFIG };