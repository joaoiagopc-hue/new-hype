// ticket.js
// Painel de tickets em estilo "HYPE" — envia um embed chamativo + SelectMenu para escolher tipo de atendimento.
// Edite o bloco CONFIG se quiser sobrescrever via setup().

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const CONFIG = {
  PANEL_TITLE: 'HYPE Suporte',
  BANNER_IMAGE: 'https://cdn.discordapp.com/attachments/1519870266216288270/1538186432072392844/content.png?ex=6a81c33f&is=6a8071bf&hm=8f79d661093d4e5e3ea4b0d7f756eceaeb40fe4cdb6441781566b21bfc6250d3&' // opcional: URL da imagem do painel (deixe vazio se não quiser)
};

let client;

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

async function onTicketCommand(message) {
  try {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ content: 'Você precisa da permissão Gerenciar Servidor para postar o painel de atendimento.', ephemeral: true });
    }

    // remove painéis antigos com mesmo título publicados pelo bot
    try {
      const msgs = await message.channel.messages.fetch({ limit: 100 });
      const botMsgs = msgs.filter(m => m.author?.id === client.user.id && m.embeds?.[0]?.title === CONFIG.PANEL_TITLE);
      for (const m of botMsgs.values()) await m.delete().catch(() => {});
    } catch (err) {
      console.error('Erro apagando painéis antigos (ticket):', err);
    }

    const embed = new EmbedBuilder()
      .setTitle(CONFIG.PANEL_TITLE)
      .setDescription('Tá com dúvida, denúncia ou quer comprar algo? Nossa equipe HYPE tá pronta pra te ajudar — escolha abaixo o tipo de atendimento que você precisa.')
      .setColor('#8a2be2')
      .addFields(
        { name: '🎯 Atendimento', value: 'Atendimento geral — suporte, dúvidas e ajuda rápida', inline: true },
        { name: '🚨 Denúncias', value: 'Relate comportamentos que infrinjam as regras', inline: true },
        { name: '💬 Dúvidas', value: 'Informações e perguntas gerais', inline: true }
      )
      .setFooter({ text: 'Selecione o tipo e o ticket será aberto automaticamente. Apenas você verá o conteúdo do seu ticket com a staff.' });

    if (CONFIG.BANNER_IMAGE) embed.setImage(CONFIG.BANNER_IMAGE);

    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_open_select')
      .setPlaceholder('Selecione o tipo de atendimento')
      .addOptions([
        { label: 'Atendimento', value: 'atendimento', description: 'Atendimento geral', emoji: '🎯' },
        { label: 'Denúncia', value: 'denuncia', description: 'Denunciar usuário/problema', emoji: '🚨' },
        { label: 'Dúvidas', value: 'duvida', description: 'Perguntas gerais', emoji: '❓' },
        { label: 'Compras', value: 'compras', description: 'Compras e produtos', emoji: '🛒' },
        { label: 'Owner League', value: 'owner_league', description: 'Solicitar Owner / Owner League', emoji: '🏆' },
        { label: 'Outros', value: 'outros', description: 'Assuntos variados', emoji: '🔧' }
      ]);

    const row = new ActionRowBuilder().addComponents(select);
    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'Painel de atendimento HYPE enviado.', ephemeral: true });
  } catch (err) {
    console.error('onTicketCommand error', err);
    return message.reply({ content: 'Erro ao enviar painel de tickets.', ephemeral: true });
  }
}

module.exports = { setup, onTicketCommand, CONFIG };