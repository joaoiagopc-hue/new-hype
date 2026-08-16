// commands/admin/assistente_botoes.js
// Painel "assistente" estilo lorrita — botoes + modais para mutar/desmutar/apagar/criar-embed/ajuda.
// Usar junto do index.js que roteia interactionCreate.
//
// COLE_AQUI_*: ajuste se quiser notificar um canal de staff em erros (opcional).

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');

const CONFIG = {
  STAFF_CHANNEL_ID: '1538198584032362598'
};

let client;
function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
  console.log('assistente_botoes setup');
}

// cria painel (use this to send the panel message)
async function createPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('Assistente — Lorrita')
    .setDescription('Painel rápido — clique no botão correspondente à ação que deseja executar.')
    .setColor('#000000');

  const btnCriar = new ButtonBuilder().setCustomId('assist_criar_embed').setLabel('Criar Embed').setStyle(ButtonStyle.Primary);
  const btnMutar = new ButtonBuilder().setCustomId('assist_mutar').setLabel('Mutar').setStyle(ButtonStyle.Danger);
  const btnDesmutar = new ButtonBuilder().setCustomId('assist_desmutar').setLabel('Desmutar').setStyle(ButtonStyle.Success);
  const btnApagar = new ButtonBuilder().setCustomId('assist_apagar').setLabel('Apagar').setStyle(ButtonStyle.Secondary);
  const btnAjuda = new ButtonBuilder().setCustomId('assist_ajuda').setLabel('Ajuda').setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(btnCriar, btnMutar, btnDesmutar, btnApagar, btnAjuda);
  return channel.send({ embeds: [embed], components: [row] });
}

async function handleInteraction(interaction) {
  try {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return false;

    // BOTÕES -> abrem modais ou respondem
    if (interaction.isButton()) {
      if (interaction.customId === 'assist_ajuda') {
        const e = new EmbedBuilder()
          .setTitle('Ajuda — Assistente Lorrita')
          .setDescription('Comandos rápidos disponíveis:\n\n• `!mutar @user` — mute\n• `!desmutar @user` — unmute\n• `!apagar <n>` — apaga n mensagens (max 100)\n• `!criar` — criar embed a partir de sua próxima mensagem\n\nOu use os botões para abrir modais.')
          .setColor('#000000')
          .setFooter({ text: 'Estilo Lorrita' });
        await interaction.reply({ embeds: [e], ephemeral: true });
        return true;
      }

      // abrir modal para criar embed diretamente pelo painel
      if (interaction.customId === 'assist_criar_embed') {
        const modal = new ModalBuilder().setCustomId('assist_modal_criar_embed').setTitle('Criar Embed — Lorrita');
        const content = new TextInputBuilder().setCustomId('embed_content').setLabel('Conteúdo do embed (texto)').setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(content));
        await interaction.showModal(modal);
        return true;
      }

      // mutar modal: pede menção/id e motivo opcional
      if (interaction.customId === 'assist_mutar') {
        const modal = new ModalBuilder().setCustomId('assist_modal_mutar').setTitle('Mutar usuário — Lorrita');
        const user = new TextInputBuilder().setCustomId('mutar_user').setLabel('Mencione ou cole o ID do usuário').setStyle(TextInputStyle.Short).setRequired(true);
        const motivo = new TextInputBuilder().setCustomId('mutar_motivo').setLabel('Motivo (opcional)').setStyle(TextInputStyle.Short).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(user), new ActionRowBuilder().addComponents(motivo));
        await interaction.showModal(modal);
        return true;
      }

      if (interaction.customId === 'assist_desmutar') {
        const modal = new ModalBuilder().setCustomId('assist_modal_desmutar').setTitle('Desmutar usuário — Lorrita');
        const user = new TextInputBuilder().setCustomId('desmutar_user').setLabel('Mencione ou cole o ID do usuário').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(user));
        await interaction.showModal(modal);
        return true;
      }

      if (interaction.customId === 'assist_apagar') {
        const modal = new ModalBuilder().setCustomId('assist_modal_apagar').setTitle('Apagar mensagens — Lorrita');
        const qtd = new TextInputBuilder().setCustomId('apagar_qtd').setLabel('Quantidade (máx 100)').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(qtd));
        await interaction.showModal(modal);
        return true;
      }
    }

    // MODALS submitted
    if (interaction.isModalSubmit()) {
      // Criar embed direto via modal
      if (interaction.customId === 'assist_modal_criar_embed') {
        const content = interaction.fields.getTextInputValue('embed_content');
        const embed = new EmbedBuilder().setDescription(content).setColor('#000000').setFooter({ text: 'Criado via Assistente Lorrita' });
        await interaction.reply({ embeds: [embed] });
        return true;
      }

      // Mutar via modal
      if (interaction.customId === 'assist_modal_mutar') {
        const userText = interaction.fields.getTextInputValue('mutar_user');
        const motivo = interaction.fields.getTextInputValue('mutar_motivo') || 'Sem motivo informado';
        const guild = interaction.guild;
        if (!guild) return interaction.reply({ content: 'Ação disponível apenas no servidor.', ephemeral: true });

        // resolve member
        const id = userText.replace(/[<@!>]/g, '').trim();
        const member = await guild.members.fetch(id).catch(()=>null);
        if (!member) return interaction.reply({ content: 'Usuário não encontrado.', ephemeral: true });

        // ensure Muted role exists
        let mutedRole = guild.roles.cache.find(r => r.name === 'Muted');
        if (!mutedRole) {
          try {
            mutedRole = await guild.roles.create({ name: 'Muted', reason: 'Criado pelo Assistente Lorrita para mutar usuários' });
            // try set channel overwrites for each text channel
            for (const [, ch] of guild.channels.cache) {
              try {
                if (ch.permissionsFor) {
                  await ch.permissionOverwrites.create(mutedRole, { SendMessages: false, AddReactions: false }).catch(()=>{});
                }
              } catch {}
            }
          } catch (e) {
            console.error('Erro criando Muted role:', e && e.stack ? e.stack : e);
            return interaction.reply({ content: 'Não foi possível criar cargo Muted. Verifique permissões do bot.', ephemeral: true });
          }
        }

        // add role
        try {
          await member.roles.add(mutedRole, `Mutado via Assistente Lorrita por ${interaction.user.tag}: ${motivo}`);
          const embed = new EmbedBuilder().setTitle('Usuário mutado').setDescription(`<@${member.id}> foi mutado.\nMotivo: ${motivo}`).setColor('#000000');
          await interaction.reply({ embeds: [embed] });
        } catch (e) {
          console.error('Erro ao mutar:', e && e.stack ? e.stack : e);
          await interaction.reply({ content: 'Falha ao aplicar mute. Verifique permissões (Manage Roles).', ephemeral: true });
        }
        return true;
      }

      // Desmutar
      if (interaction.customId === 'assist_modal_desmutar') {
        const userText = interaction.fields.getTextInputValue('desmutar_user');
        const id = userText.replace(/[<@!>]/g, '').trim();
        const guild = interaction.guild;
        const member = guild ? await guild.members.fetch(id).catch(()=>null) : null;
        if (!member) return interaction.reply({ content: 'Usuário não encontrado.', ephemeral: true });
        const mutedRole = guild.roles.cache.find(r => r.name === 'Muted');
        if (!mutedRole) return interaction.reply({ content: 'Cargo Muted não encontrado.', ephemeral: true });

        try {
          await member.roles.remove(mutedRole, `Desmutado via Assistente Lorrita por ${interaction.user.tag}`);
          const embed = new EmbedBuilder().setTitle('Usuário desmutado').setDescription(`<@${member.id}> foi desmutado.`).setColor('#000000');
          await interaction.reply({ embeds: [embed] });
        } catch (e) {
          console.error('Erro ao desmutar:', e && e.stack ? e.stack : e);
          await interaction.reply({ content: 'Falha ao remover mute. Verifique permissões (Manage Roles).', ephemeral: true });
        }
        return true;
      }

      // Apagar mensagens
      if (interaction.customId === 'assist_modal_apagar') {
        const qtdText = interaction.fields.getTextInputValue('apagar_qtd');
        const qtd = Math.min(100, Math.max(1, parseInt(qtdText, 10) || 0));
        if (qtd <= 0) return interaction.reply({ content: 'Quantidade inválida.', ephemeral: true });
        const ch = interaction.channel;
        try {
          const deleted = await ch.bulkDelete(qtd, true);
          const embed = new EmbedBuilder().setTitle('Mensagens apagadas').setDescription(`Foram apagadas ${deleted.size} mensagens.`).setColor('#000000');
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (e) {
          console.error('Erro ao bulkDelete:', e && e.stack ? e.stack : e);
          await interaction.reply({ content: 'Falha ao apagar mensagens. Mensagens com mais de 14 dias não podem ser apagadas em lote.', ephemeral: true });
        }
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('assistente_botoes error:', err && err.stack ? err.stack : err);
    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno no assistente.', ephemeral: true }); } catch {}
    // notify staff channel if configured
    try {
      if (CONFIG.STAFF_CHANNEL_ID && CONFIG.STAFF_CHANNEL_ID !== 'COLE_AQUI_STAFF_CHANNEL_ID') {
        const ch = await client.channels.fetch(CONFIG.STAFF_CHANNEL_ID).catch(()=>null);
        if (ch) await ch.send(`Erro assistente_botoes: ${err && err.stack ? err.stack : err}`); 
      }
    } catch {}
    return true;
  }
}

module.exports = { setup, handleInteraction, createPanel, CONFIG };