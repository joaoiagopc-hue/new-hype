// commands/rp/ticket.js
// Painel HYPE de tickets — opções: Denúncia, Suporte, Compras
// Uso: !painel-ticket (requer Manage Guild para postar o painel)

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const CONFIG = {
  PANEL_TITLE: 'Atendimento HYPE',
  BANNER_IMAGE: 'https://cdn.discordapp.com/attachments/1519870266216288270/1538186432072392844/content.png?ex=6a81c33f&is=6a8071bf&hm=8f79d661093d4e5e3ea4b0d7f756eceaeb40fe4cdb6441781566b21bfc6250d3&' // opcional: URL pública para banner
};

let client;
function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

async function onTicketCommand(message) {
  try {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ content: 'Você precisa da permissão "Gerenciar Servidor" para postar o painel de atendimento.', ephemeral: true });
    }

    // remove painéis antigos com mesmo título publicados pelo bot (limpeza)
    try {
      const msgs = await message.channel.messages.fetch({ limit: 100 });
      const botMsgs = msgs.filter(m => m.author?.id === client.user.id && m.embeds?.[0]?.title === CONFIG.PANEL_TITLE);
      for (const m of botMsgs.values()) {
        await m.delete().catch(()=>{});
      }
    } catch (err) {
      console.warn('Aviso ao apagar painéis antigos (não bloqueante):', err?.message || err);
    }

    const embed = new EmbedBuilder()
      .setTitle(CONFIG.PANEL_TITLE)
      .setDescription('Precisa de ajuda? Escolha abaixo o tipo de atendimento que deseja: Denúncia, Suporte ou Compras. Apenas você e a staff terão acesso ao ticket.')
      .setColor('#8a2be2')
      .setFooter({ text: 'Selecione o tipo e seu ticket será aberto automaticamente.' });

    if (CONFIG.BANNER_IMAGE) embed.setImage(CONFIG.BANNER_IMAGE);

    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_open_select')
      .setPlaceholder('Selecione o tipo de atendimento')
      .addOptions([
        { label: 'Denúncia', value: 'denuncia', description: 'Relatar comportamento que viole as regras', emoji: '🚨' },
        { label: 'Suporte', value: 'suporte', description: 'Atendimento geral / dúvidas', emoji: '🎯' },
        { label: 'Compras', value: 'compras', description: 'Dúvidas sobre compras e produtos', emoji: '🛒' }
      ]);

    const row = new ActionRowBuilder().addComponents(select);
    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'Painel de atendimento HYPE enviado.', ephemeral: true });
  } catch (err) {
    console.error('onTicketCommand error:', err && err.stack ? err.stack : err);
    return message.reply({ content: 'Erro ao enviar painel de tickets.', ephemeral: true });
  }
}

module.exports = { setup, onTicketCommand, CONFIG };