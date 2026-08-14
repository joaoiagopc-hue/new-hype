/* commands/admin/wl_botoes.js */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const dataStore = require('../../dataStore');

/*
  CONFIG - cole os IDs dos cargos aqui (ou use .env)
  - ROLE_FROM_ID: cargo que o usuário recebeu ao pegar o ID (será REMOVIDO ao passar)
  - ROLE_UNREGISTERED_ID: cargo de não-registrado (será REMOVIDO ao passar)
  - ROLE_REGISTERED_ID: cargo final (será ADICIONADO ao passar)
  - WL_QUESTIONS e WL_PASS_MIN podem ser ajustados aqui ou via .env
*/
const CONFIG = {
  ROLE_FROM_ID: '1537933883788763177',
  ROLE_UNREGISTERED_ID: '1537876556322570461',
  ROLE_REGISTERED_ID: '1537843709284982805',
  WL_QUESTIONS: 7,
  WL_PASS_MIN: 4
};

const ROLE_FROM_ID = CONFIG.ROLE_FROM_ID && !CONFIG.ROLE_FROM_ID.startsWith('COLOQUE') ? CONFIG.ROLE_FROM_ID : process.env.ID_ROLE_ID;
const ROLE_UNREGISTERED_ID = CONFIG.ROLE_UNREGISTERED_ID && !CONFIG.ROLE_UNREGISTERED_ID.startsWith('COLOQUE') ? CONFIG.ROLE_UNREGISTERED_ID : process.env.ROLE_UNREGISTERED_ID;
const ROLE_REGISTERED_ID = CONFIG.ROLE_REGISTERED_ID && !CONFIG.ROLE_REGISTERED_ID.startsWith('COLOQUE') ? CONFIG.ROLE_REGISTERED_ID : process.env.ROLE_REGISTERED_ID;
const TOTAL_QUESTIONS = Number(CONFIG.WL_QUESTIONS || process.env.WL_QUESTIONS || 7);
const PASS_MIN = Number(CONFIG.WL_PASS_MIN || process.env.WL_PASS_MIN || 4);

// perguntas (edite como quiser)
const QUESTIONS = [
  { question: 'Qual é o comportamento esperado no RP ao entrar em um local privado?', choices: ['A) Entrar e mexer em tudo', 'B) Pedir permissão/seguir regras', 'C) Invadir e roubar', 'D) Ignorar players'], answer: 'B' },
  { question: 'O que fazer se você encontrar um bug que quebra o RP?', choices: ['A) Explorar e abusar', 'B) Ignorar', 'C) Reportar para staff', 'D) Compartilhar publicamente'], answer: 'C' },
  { question: 'Ao ser preso no RP, você deve:', choices: ['A) Pedir for spawn', 'B) Continuar a agir fora do RP', 'C) Seguir a situação e cooperar', 'D) Abusar do chat'], answer: 'C' },
  { question: 'Qual destas atitudes é aceitável durante RP?', choices: ['A) Metagaming', 'B) Powergaming', 'C) Respeitar limites e contexto', 'D) Trolling'], answer: 'C' },
  { question: 'Se alguém pede para parar uma cena RP, você deve:', choices: ['A) Continuar', 'B) Respeitar e parar', 'C) Ignorar', 'D) Ri e gravar'], answer: 'B' },
  { question: 'O uso de scripts externos que dão vantagem é:', choices: ['A) Permitido', 'B) Obrigatório', 'C) Proibido', 'D) Opcional'], answer: 'C' },
  { question: 'Ao ver um conflito entre players, a melhor atitude é:', choices: ['A) Agravar', 'B) Reportar para staff se necessário', 'C) Usar exploits', 'D) Gravar sem avisar'], answer: 'B' }
];

// sessões em memória: userId -> { index, correct }
const sessions = new Map();

function buildQuestionEmbed(userId, idx) {
  const q = QUESTIONS[idx];
  return new EmbedBuilder()
    .setTitle(`Pergunta ${idx + 1} / ${TOTAL_QUESTIONS}`)
    .setDescription(q.question)
    .addFields(
      { name: 'A', value: q.choices[0], inline: false },
      { name: 'B', value: q.choices[1], inline: false },
      { name: 'C', value: q.choices[2], inline: false },
      { name: 'D', value: q.choices[3], inline: false }
    )
    .setColor(0x2F3136)
    .setFooter({ text: `Respondendo como: ${userId}` });
}

function buildAnswerRow(userId, idx) {
  const base = `wl_answer|${userId}|${idx}|`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(base + 'A').setLabel('A').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(base + 'B').setLabel('B').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(base + 'C').setLabel('C').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(base + 'D').setLabel('D').setStyle(ButtonStyle.Primary)
  );
}

async function handleInteraction(interaction) {
  if (!interaction.isButton()) return;
  const { customId, user, guild } = interaction;

  if (customId === 'wl_start') {
    if (sessions.has(user.id)) {
      return interaction.reply({ content: 'Você já tem uma sessão em andamento.', ephemeral: true });
    }
    const session = { index: 0, correct: 0 };
    sessions.set(user.id, session);
    await interaction.reply({ content: 'Quiz iniciado! As perguntas serão enviadas no canal.', ephemeral: true });

    const qEmbed = buildQuestionEmbed(user.id, 0);
    const qRow = buildAnswerRow(user.id, 0);
    return interaction.channel.send({ content: `${user}`, embeds: [qEmbed], components: [qRow] });
  }

  if (customId.startsWith('wl_answer|')) {
    const parts = customId.split('|');
    const targetUser = parts[1];
    const idx = Number(parts[2]);
    const choice = parts[3];

    if (user.id !== targetUser) {
      return interaction.reply({ content: 'Este quiz não é seu — clique apenas nas suas opções.', ephemeral: true });
    }

    const session = sessions.get(user.id);
    if (!session) return interaction.reply({ content: 'Sessão não encontrada. Use !painel-wl para iniciar.', ephemeral: true });
    if (idx !== session.index) return interaction.reply({ content: 'Esta pergunta já foi respondida ou não é a atual.', ephemeral: true });

    const correctAnswer = QUESTIONS[idx].answer;
    const isCorrect = choice === correctAnswer;
    if (isCorrect) session.correct += 1;
    await interaction.reply({ content: isCorrect ? '✅ Correto!' : `❌ Incorreto. Resposta certa: ${correctAnswer}`, ephemeral: true });

    session.index += 1;

    if (session.index >= TOTAL_QUESTIONS) {
      const score = session.correct;
      const passed = score >= PASS_MIN;

      const data = dataStore.load();
      if (!data.users) data.users = {};
      if (!data.users[user.id]) data.users[user.id] = {};
      data.users[user.id].whitelist = { passed, score, timestamp: new Date().toISOString() };
      dataStore.save(data);

      if (passed && guild) {
        try {
          const member = await guild.members.fetch(user.id);
          if (ROLE_FROM_ID) { try { await member.roles.remove(ROLE_FROM_ID); } catch (e) { console.warn('Remover ROLE_FROM_ID falhou:', e.message || e); } }
          if (ROLE_UNREGISTERED_ID) { try { await member.roles.remove(ROLE_UNREGISTERED_ID); } catch (e) { console.warn('Remover ROLE_UNREGISTERED_ID falhou:', e.message || e); } }
          if (ROLE_REGISTERED_ID) { try { await member.roles.add(ROLE_REGISTERED_ID); } catch (e) { console.warn('Adicionar ROLE_REGISTERED_ID falhou:', e.message || e); } }
        } catch (e) {
          console.warn('Falha ao processar roles WL:', e.message || e);
        }
      }

      sessions.delete(user.id);

      const resultEmbed = new EmbedBuilder()
        .setTitle(passed ? 'Whitelist Aprovada ✅' : 'Whitelist Reprovada ❌')
        .setDescription(`Você acertou **${score}** de **${TOTAL_QUESTIONS}** perguntas.`)
        .setColor(passed ? 0x57F287 : 0xED4245);

      return interaction.channel.send({ content: `${user}`, embeds: [resultEmbed] });
    } else {
      const nextIdx = session.index;
      const qEmbed = buildQuestionEmbed(user.id, nextIdx);
      const qRow = buildAnswerRow(user.id, nextIdx);
      return interaction.channel.send({ content: `${user}`, embeds: [qEmbed], components: [qRow] });
    }
  }
}

module.exports = { handleInteraction };