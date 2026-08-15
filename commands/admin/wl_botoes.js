// wl_botoes.js
// Quiz de WL + aplicação/removal de cargos conforme a sua estrutura.
// CONFIG no topo — cole os IDs do Discord aqui.

const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CONFIG = {
  DATA_FILE: path.join(__dirname, 'data.json'),
  WL_ROLE_ID: '1537933883788763177',           // cargo "com id" -> será REMOVIDO se passar no quiz
  ROLE_NO_REG_ID: '1537876556322570461',   // cargo "sem registro" -> será REMOVIDO se passar no quiz
  REGISTERED_ROLE_ID: '1537843709284982805', // cargo "registrado" -> será ADICIONADO se passar
  STAFF_CHANNEL_ID: '1537883932497018932',    // canal para notificar aprovações (opcional)
  PASSING_SCORE: 4                              // acertos mínimos para passar
};

let client;

const QUIZ_QUESTIONS = [
  { q: 'Qual atitude NÃO é aceitável durante um roleplay?', choices: { A: 'Respeitar limites', B: 'Metagaming', C: 'Agir no personagem', D: 'Seguir as regras' }, correct: 'B' },
  { q: 'O que é powergaming?', choices: { A: 'Interpretar com criatividade', B: 'Forçar ações impossíveis sobre outros', C: 'Ajudar aliados', D: 'Reportar bugs' }, correct: 'B' },
  { q: 'Onde estão as regras de RP do servidor?', choices: { A: 'Canal #regras', B: 'DMs aleatórias', C: 'Dentro do nick', D: 'Sites externos' }, correct: 'A' },
  { q: 'Se alguém te ferir no RP sem aviso, você deve:', choices: { A: 'Vingar no jogo', B: 'Sair e não reportar', C: 'Reportar ao staff com evidências', D: 'Divulgar no chat' }, correct: 'C' },
  { q: 'Quantas tentativas imediatas é recomendado?', choices: { A: 'Ilimitado', B: 'Pode haver espera / staff avalia', C: 'Nunca', D: 'Uma vez' }, correct: 'B' },
  { q: 'O que evita conflitos reais no RP?', choices: { A: 'Separar player do personagem', B: 'Confundir real com RP', C: 'Trolar', D: 'Vazar dados' }, correct: 'A' },
  { q: 'Conduta esperada de um whitelistado?', choices: { A: 'Trolar', B: 'Ser tóxico', C: 'Respeitar e ajudar', D: 'Vender contas' }, correct: 'C' }
];

const quizSessions = new Map();
const userSession = new Map();

function setup(localClient, overrides = {}) {
  client = localClient;
  // permitir sobrescrever CONFIG via setup se desejar
  Object.assign(CONFIG, overrides);
  if (overrides.DATA_FILE) CONFIG.DATA_FILE = overrides.DATA_FILE;
}

function loadData() {
  if (!fs.existsSync(CONFIG.DATA_FILE)) {
    fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));
  }
  const raw = fs.readFileSync(CONFIG.DATA_FILE, 'utf8') || '{}';
  try { return JSON.parse(raw); } catch { return { nextId: 10, applications: {}, ids: {} }; }
}
function saveData(data) { fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2)); }

async function handleInteraction(interaction) {
  try {
    // inicia o quiz (botão do painel)
    if (interaction.isButton() && interaction.customId === 'wl_iniciar') {
      if (userSession.has(interaction.user.id)) {
        return interaction.reply({ content: 'Você já tem um quiz em andamento.', ephemeral: true });
      }
      const sessionId = Date.now().toString();
      quizSessions.set(sessionId, { userId: interaction.user.id, qIndex: 0, correctCount: 0 });
      userSession.set(interaction.user.id, sessionId);
      return await sendQuestion(interaction, sessionId);
    }

    // respostas do quiz: quiz|<sessionId>|<choice>
    if (interaction.isButton() && interaction.customId.startsWith('quiz|')) {
      const [, sessionId, choice] = interaction.customId.split('|');
      const session = quizSessions.get(sessionId);
      if (!session) return interaction.reply({ content: 'Sessão inválida/expirada.', ephemeral: true });
      if (interaction.user.id !== session.userId) return interaction.reply({ content: 'Este quiz não é seu.', ephemeral: true });

      const qObj = QUIZ_QUESTIONS[session.qIndex];
      if (choice === qObj.correct) session.correctCount++;
      session.qIndex++;

      if (session.qIndex < QUIZ_QUESTIONS.length) return await sendQuestion(interaction, sessionId);

      // terminou
      const score = session.correctCount;
      const passed = score >= (CONFIG.PASSING_SCORE || 4);
      quizSessions.delete(sessionId);
      userSession.delete(interaction.user.id);

      if (passed) {
        await processPass(interaction, score);
      } else {
        await processFail(interaction, score);
      }
      return true;
    }

    return false;
  } catch (err) {
    console.error('wl_botoes error', err);
    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno no quiz.', ephemeral: true }); } catch {}
    return false;
  }
}

async function processPass(interaction, score) {
  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);

    // remove cargo com id
    if (CONFIG.WL_ROLE_ID && CONFIG.WL_ROLE_ID !== 'COLE_AQUI_WL_ROLE_ID') {
      try { if (member.roles.cache.has(CONFIG.WL_ROLE_ID)) await member.roles.remove(CONFIG.WL_ROLE_ID, 'Passou na WL - remover cargo com id'); } catch(e){ console.error('remove WL_ROLE', e); }
    }
    // remove cargo sem registro
    if (CONFIG.ROLE_NO_REG_ID && CONFIG.ROLE_NO_REG_ID !== 'COLE_AQUI_ROLE_NO_REG_ID') {
      try { if (member.roles.cache.has(CONFIG.ROLE_NO_REG_ID)) await member.roles.remove(CONFIG.ROLE_NO_REG_ID, 'Passou na WL - remover cargo sem registro'); } catch(e){ console.error('remove NO_REG', e); }
    }
    // adiciona registrado
    if (CONFIG.REGISTERED_ROLE_ID && CONFIG.REGISTERED_ROLE_ID !== 'COLE_AQUI_REGISTERED_ROLE_ID') {
      try { await member.roles.add(CONFIG.REGISTERED_ROLE_ID, 'Passou na WL - adicionar cargo registrado'); } catch(e){ console.error('add REGISTERED', e); }
    }

    // salva histórico
    const data = loadData();
    const appId = Date.now().toString();
    data.applications = data.applications || {};
    data.applications[appId] = {
      applicantId: interaction.user.id,
      declaredNick: member.user.username,
      motivo: `Quiz aprovado ${score}/${QUIZ_QUESTIONS.length}`,
      status: 'approved-by-quiz',
      quizScore: score,
      createdAt: new Date().toISOString()
    };
    saveData(data);

    // DM de confirmação
    try { await interaction.user.send(`Parabéns! Você foi aprovado na WL com ${score}/${QUIZ_QUESTIONS.length}. Você recebeu o cargo de registrado.`).catch(()=>{}); } catch {}

    // notificar staff
    try {
      if (CONFIG.STAFF_CHANNEL_ID && CONFIG.STAFF_CHANNEL_ID !== 'COLE_AQUI_STAFF_CHANNEL_ID') {
        const ch = await interaction.guild.channels.fetch(CONFIG.STAFF_CHANNEL_ID);
        if (ch) {
          await ch.send({ embeds: [ new EmbedBuilder().setTitle('WL - Usuário Aprovado').setDescription(`${interaction.user.tag} passou no quiz (${score}/${QUIZ_QUESTIONS.length})`).setColor('#2ecc71') ] }).catch(()=>{});
        }
      }
    } catch (err) { console.error('notify staff', err); }

    // resposta ao usuário
    try {
      await interaction.update({
        embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Aprovado — ${score}/${QUIZ_QUESTIONS.length}`).setColor('#2ecc71') ],
        components: []
      });
    } catch {
      await interaction.reply({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Aprovado — ${score}/${QUIZ_QUESTIONS.length}`).setColor('#2ecc71') ], ephemeral: true });
    }
  } catch (err) {
    console.error('processPass error', err);
    try { await interaction.reply({ content: 'Erro ao processar aprovação.', ephemeral: true }); } catch {}
  }
}

async function processFail(interaction, score) {
  try {
    try { await interaction.user.send(`Você acertou ${score}/${QUIZ_QUESTIONS.length}. Não atingiu o mínimo de ${CONFIG.PASSING_SCORE || 4}. Tente novamente mais tarde.`).catch(()=>{}); } catch {}
    try {
      await interaction.update({
        embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Reprovado — ${score}/${QUIZ_QUESTIONS.length}. Necessário ${CONFIG.PASSING_SCORE || 4}.`).setColor('#e74c3c') ],
        components: []
      });
    } catch {
      await interaction.reply({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Reprovado — ${score}/${QUIZ_QUESTIONS.length}. Necessário ${CONFIG.PASSING_SCORE || 4}.`).setColor('#e74c3c') ], ephemeral: true });
    }
  } catch (err) {
    console.error('processFail error', err);
  }
}

async function sendQuestion(interaction, sessionId) {
  const session = quizSessions.get(sessionId);
  if (!session) throw new Error('session not found');
  const qObj = QUIZ_QUESTIONS[session.qIndex];

  const embed = new EmbedBuilder()
    .setTitle(`Pergunta ${session.qIndex + 1}/${QUIZ_QUESTIONS.length}`)
    .setDescription(qObj.q)
    .setColor('#ffb86b')
    .addFields(
      { name: 'A', value: qObj.choices.A, inline: true },
      { name: 'B', value: qObj.choices.B, inline: true },
      { name: 'C', value: qObj.choices.C, inline: true },
      { name: 'D', value: qObj.choices.D, inline: true }
    );

  const a = new ButtonBuilder().setCustomId(`quiz|${sessionId}|A`).setLabel('A').setStyle(ButtonStyle.Primary);
  const b = new ButtonBuilder().setCustomId(`quiz|${sessionId}|B`).setLabel('B').setStyle(ButtonStyle.Primary);
  const c = new ButtonBuilder().setCustomId(`quiz|${sessionId}|C`).setLabel('C').setStyle(ButtonStyle.Primary);
  const d = new ButtonBuilder().setCustomId(`quiz|${sessionId}|D`).setLabel('D').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(a, b, c, d);

  try {
    await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
  } catch (err) {
    try { await interaction.reply({ embeds: [embed], components: [row], ephemeral: true }); } catch (e) { console.error('Erro ao enviar pergunta:', e); }
  }
}

module.exports = { setup, handleInteraction, CONFIG };