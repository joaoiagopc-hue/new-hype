/* commands/rp/id.js */
require('dotenv').config();
const dataStore = require('../../dataStore');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/*
  CONFIG - cole os IDs aqui (ou use .env)
  ID_ROLE_ID: cargo a ser adicionado quando o usuário pegar o ID
  START_ID: número inicial do ID (ex: 10)
*/
const CONFIG = {
  ID_ROLE_ID: 'COLOQUE_ID_ROLE_GANHOU_ID_AQUI',
  START_ID: 10
};

const ID_ROLE_ID = CONFIG.ID_ROLE_ID && !CONFIG.ID_ROLE_ID.startsWith('COLOQUE') ? CONFIG.ID_ROLE_ID : process.env.ID_ROLE_ID;
const START_ID = Number(CONFIG.START_ID || process.env.START_ID || 10);

async function handleIdCommand(message) {
  if (message.author.bot) return;
  if (!message.guild) return message.reply('Comando só pode ser usado dentro de um servidor.');

  const data = dataStore.load();
  const userId = message.author.id;

  if (data.users[userId]) {
    const u = data.users[userId];
    return message.reply(`Você já tem ID: ${u.id} | ${u.nick}`);
  }

  const assignedId = data.nextId || START_ID;
  data.users[userId] = { id: assignedId, nick: message.author.username };
  data.nextId = assignedId + 1;
  dataStore.save(data);

  // adiciona cargo (se configurado)
  try {
    if (ID_ROLE_ID) {
      const member = await message.guild.members.fetch(userId);
      await member.roles.add(ID_ROLE_ID);
    }
  } catch (err) {
    console.warn('Falha ao adicionar cargo:', err?.message || err);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ver_id')
      .setLabel('Ver meu ID')
      .setStyle(ButtonStyle.Primary)
  );

  return message.reply({
    content: `✅ Seu ID foi registrado: **${assignedId}** — você recebeu o cargo (se configurado).`,
    components: [row],
  });
}

module.exports = { handleIdCommand };