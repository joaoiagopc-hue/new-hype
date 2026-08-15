// id.js
// Comando !id — responde em embed com imagem "registrado" quando atribui ID.
// Se usuário já tem ID, retorna embed informando que já foi registrado e mostra o ID.
// CONFIG: cole WL_ROLE_ID (opcional) e REGISTERED_IMAGE_URL.

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const CONFIG = {
  DATA_FILE: path.join(__dirname, 'data.json'),
  WL_ROLE_ID: '1537933883788763177', // opcional: cargo "com id" que será aplicado quando atribuir ID
  REGISTERED_IMAGE_URL: 'https://cdn.discordapp.com/attachments/1519870266216288270/1538193007533097110/content.png?ex=6a81c95f&is=6a8077df&hm=6a017b6d142c865ee6f047d565ca09687fa3faec8c7942b5785c0fb37bf7d449&' // URL da imagem a mostrar no embed quando registrado (ex.: https://i.imgur.com/registered.png)
};

let client;

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

function loadData() {
  if (!fs.existsSync(CONFIG.DATA_FILE)) {
    fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));
  }
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
    if (!message.guild) return message.reply({ content: 'Este comando só funciona dentro de um servidor.', ephemeral: true });
    const member = message.member;
    if (!member) return message.reply({ content: 'Não consegui obter seu membro no servidor.', ephemeral: true });

    const data = loadData();
    data.ids = data.ids || {};

    // Se já tem ID -> retorna embed informando isso
    if (data.ids[member.id]) {
      const existing = data.ids[member.id];
      const embed = new EmbedBuilder()
        .setTitle('Você já foi registrado')
        .setDescription(`Seu ID já foi registrado: **${existing}**`)
        .setColor('#161616')
        .addFields({ name: 'Observação', value: 'Você já recebeu um ID anteriormente e não pode solicitar outro.' });
      if (CONFIG.REGISTERED_IMAGE_URL) embed.setThumbnail(CONFIG.REGISTERED_IMAGE_URL);
      return message.reply({ embeds: [embed] });
    }

    // atribui novo ID
    const assigned = data.nextId || 10;
    data.nextId = Number(assigned) + 1;
    data.ids[member.id] = assigned;
    saveData(data);

    // aplica cargo WL_ROLE_ID se configurado
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

    // embed de sucesso com imagem
    const embed = new EmbedBuilder()
      .setTitle('Registro concluído')
      .setDescription(`Seu ID foi criado: **${assigned}**`)
      .setColor('#0e0f0e')
      .addFields({ name: 'Nick atualizado', value: `\`${newNick}\`` })
      .setTimestamp();

    if (CONFIG.REGISTERED_IMAGE_URL) embed.setImage(CONFIG.REGISTERED_IMAGE_URL);

    return message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('onIdCommand error', err);
    return message.reply({ content: 'Erro ao processar seu ID.', ephemeral: true });
  }
}

module.exports = { setup, onIdCommand, CONFIG };