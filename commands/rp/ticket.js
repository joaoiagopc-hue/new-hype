/* commands/rp/ticket.js
   Envia o painel de tickets com opções "Suporte" e "Denúncias".
   Ao clicar, commands/admin/ticket_botoes.js cria o canal e gerencia o ticket.
*/

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

/*
 CONFIG - cole os IDs aqui (ou use .env)
 - STAFF_ROLE_ID: cargo que será marcado quando abrir ticket (ex: @Staff)
 - TICKET_CATEGORY_ID: ID da categoria onde o canal será criado
 - START_MESSAGE_TITLE/DESC: personalização do embed
*/
const CONFIG = {
  STAFF_ROLE_ID: '1537883932497018932',
  TICKET_CATEGORY_ID: '1537936531761930370',
  // Aparência do embed
  EMBED_TITLE: 'Painel de Tickets',
  EMBED_DESCRIPTION: 'Escolha uma opção para abrir um ticket de Suporte ou Denúncias. Evite marcações desnecessárias; aguarde a staff.',
  EMBED_COLOR: 0x5865F2,
  EMBED_IMAGE_URL: '' // opcional
};

const EMBED_TITLE = CONFIG.EMBED_TITLE || process.env.TICKET_EMBED_TITLE;
const EMBED_DESCRIPTION = CONFIG.EMBED_DESCRIPTION || process.env.TICKET_EMBED_DESCRIPTION;
const EMBED_COLOR = CONFIG.EMBED_COLOR || Number(process.env.TICKET_EMBED_COLOR) || 0x5865F2;
const EMBED_IMAGE_URL = CONFIG.EMBED_IMAGE_URL || process.env.TICKET_EMBED_IMAGE_URL || '';

function buildPanelEmbed() {
  const embed = new EmbedBuilder()
    .setTitle(EMBED_TITLE)
    .setDescription(EMBED_DESCRIPTION)
    .setColor(EMBED_COLOR);

  if (EMBED_IMAGE_URL) embed.setImage(EMBED_IMAGE_URL);
  embed.setFooter({ text: 'Selecione uma das opções abaixo para abrir o ticket.' });
  return embed;
}

function buildRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_type|suporte').setLabel('Suporte').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_type|denuncias').setLabel('Denúncias').setStyle(ButtonStyle.Danger)
  );
}

async function handlePanelCommand(message) {
  if (!message.guild) return;
  try { await message.delete(); } catch (_) { /* ignore */ }

  const embed = buildPanelEmbed();
  const row = buildRow();
  await message.channel.send({ embeds: [embed], components: [row] });
}

module.exports = { handlePanelCommand };