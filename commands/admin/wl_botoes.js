// commands/admin/wl_botoes.js
// Quiz de WL (ephemeral apenas para o usuário que iniciou).
// Perguntas: RDM, VDM, POWERGAMING, METAGAMING, AMOR A VIDA, O QUE SIGNIFICA RP
//
// CONFIG:
//  - DATA_FILE: path para data.json (opcional override via setup)
//  - WL_ROLE_ID, ROLE_NO_REG_ID, REGISTERED_ROLE_ID: cargos opcionais
//  - STAFF_CHANNEL_ID: canal onde notificações de aprovação/erro serão enviadas (opcional)
//  - PASSING_SCORE: número mínimo de acertos para passar
//
// Use: wlButtons.setup(client, { DATA_FILE: '...', WL_ROLE_ID: 'id', ... })

const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CONFIG = {
  DATA_FILE: path.join(__dirname, '..', '..', 'data.json'),
  WL_ROLE_ID: '1537933883788763177',
  ROLE_NO_REG_ID: '1537876556322570461',
  REGISTERED_ROLE_ID: '1537843709284982805',
  STAFF_CHANNEL_ID: '1538198584032362598',
  PASSING_SCORE: 4
};

let client;

const QUIZ_QUESTIONS = [
  {
    q: 'O que é RDM (Random Deathmatch)?',
    choices: {
      A: 'Matar outros jogadores sem motivo de roleplay (aleatoriamente).',
      B: 'Organizar eventos de PvP com regras claras.',
      C: 'Fazer trade ou troca de itens entre jogadores.',
      D: 'Reportar bugs ao staff.'
    },
    correct: 'A'
  },
  {
    q: 'O que é VDM (Vehicle Deathmatch)?',
    choices: {
      A: 'Usar veículos apenas para roleplay seguro.',
      B: 'Atacar ou matar outros usando veículos sem contexto RP válido.',
      C: 'Consertar veículos no servidor.',
      D: 'Ajudar outros jogadores com transporte.'
    },
    correct: 'B'
  },
  {
    q: 'O que é Powergaming?',
    choices: {
      A: 'Interpretar seu personagem respeitando limitações e lógica.',
      B: 'Forçar ações impossíveis sobre outros jogadores sem dar chance de reação.',
      C: 'Criar histórias consistentes para o personagem.',
      D: 'Usar apenas itens permitidos pelo servidor.'
    },
    correct: 'B'
  },
  {
    q: 'O que é Metagaming?',
    choices: {
      A: 'Usar informações do personagem para melhorar o RP.',
      B: 'Misturar informações do jogador (fora do jogo) e usar dentro do RP para vantagem.',
      C: 'Ler as regras do servidor.',
      D: 'Reportar falhas de script.'
    },
    correct: 'B'
  },
  {
    q: 'O que significa "Amor à vida" no contexto de RP/servidor (regra social)?',
    choices: {
      A: 'Valorizar a continuidade do roleplay, evitando ações que destruam o RP sem motivo (ex.: suicídio repentino, massacres sem contexto).',
      B: 'Promover brigas pessoais fora do jogo.',
      C: 'Apostar a vida do personagem em qualquer situação por diversão.',
      D: 'Divulgar dados pessoais.'
    },
    correct: 'A'
  },
  {
    q: 'O que significa RP (Roleplay)?',
    choices: {
      A: 'Jogar sem regras ou objetivos.',
      B: 'Interpretar um personagem com histórico, motivações e agir conforme o mundo do servidor — separar player e personagem.',
      C: 'Usar cheats para ganhar vantagem.',
      D: 'Conversar apenas por mensagens privadas.'
    },
    correct: 'B'
  }
];

const quizSessions = new Map(); // sessionId -> { userId, qIndex, correctCount }
const userSession = new Map();  // userId -> sessionId

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
  if (overrides.DATA_FILE) CONFIG.DATA_FILE = overrides.DATA_FILE;
}

function loadData() {
  if (!fs.existsSync(CONFIG.DATA_FILE)) {
    fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));
  }
  try { return JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8') || '{}'); } catch { return { nextId: 10, applications: {}, ids: {} }; }
}
function saveData(data) { fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2)); }

async function handleInteraction(interaction) {
  try {
    // inicia quiz (botão público do painel com customId 'wl_iniciar')
    if (interaction.isButton() && interaction.customId === 'wl_iniciar') {
      if (userSession.has(interaction.user.id)) {
        return interaction.reply({ content: 'Você já tem um quiz em andamento.', ephemeral: true });
      }
      const sessionId = Date.now().toString();
      quizSessions.set(sessionId, { userId: interaction.user.id, qIndex: 0, correctCount: 0 });
      userSession.set(interaction.user.id, sessionId);
      return await sendQuestion(interaction, sessionId, { initial: true });
    }

    // respostas (quiz|<sessionId>|<choice>)
    if (interaction.isButton() && interaction.customId.startsWith('quiz|')) {
      const [, sessionId, choice] = interaction.customId.split('|');
      const session = quizSessions.get(sessionId);
      if (!session) return interaction.reply({ content: 'Sessão inválida/expirada.', ephemeral: true });

      // somente o dono da sessão responde
      if (interaction.user.id !== session.userId) return interaction.reply({ content: 'Este quiz não é seu.', ephemeral: true });

      const qObj = QUIZ_QUESTIONS[session.qIndex];
      if (choice === qObj.correct) session.correctCount++;
      session.qIndex++;

      if (session.qIndex < QUIZ_QUESTIONS.length) return await sendQuestion(interaction, sessionId, { initial: false });

      // terminou
      const score = session.correctCount;
      const passed = score >= (CONFIG.PASSING_SCORE || 4);

      quizSessions.delete(sessionId);
      userSession.delete(interaction.user.id);

      if (passed) {
        await onPass(interaction, score);
      } else {
        await onFail(interaction, score);
      }
      return true;
    }

    return false;
  } catch (err) {
    console.error('wl_botoes error:', err && err.stack ? err.stack : err);
    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno no quiz.', ephemeral: true }); } catch {}
    return false;
  }
}

async function sendQuestion(interaction, sessionId, opts = { initial: false }) {
  const session = quizSessions.get(sessionId);
  if (!session) throw new Error('session not found');
  const qObj = QUIZ_QUESTIONS[session.qIndex];

  const description = `**${qObj.q}**\n\nA) ${qObj.choices.A}\nB) ${qObj.choices.B}\nC) ${qObj.choices.C}\nD) ${qObj.choices.D}`;

  const embed = new EmbedBuilder()
    .setTitle(`Pergunta ${session.qIndex + 1}/${QUIZ_QUESTIONS.length}`)
    .setDescription(description)
    .setColor('#0f0e0c')
    .setFooter({ text: `Progresso: ${session.qIndex + 1}/${QUIZ_QUESTIONS.length}` })
    .setTimestamp();

  const a = new ButtonBuilder().setCustomId(`quiz|${sessionId}|A`).setLabel('A').setStyle(ButtonStyle.Primary);
  const b = new ButtonBuilder().setCustomId(`quiz|${sessionId}|B`).setLabel('B').setStyle(ButtonStyle.Primary);
  const c = new ButtonBuilder().setCustomId(`quiz|${sessionId}|C`).setLabel('C').setStyle(ButtonStyle.Primary);
  const d = new ButtonBuilder().setCustomId(`quiz|${sessionId}|D`).setLabel('D').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(a, b, c, d);

  try {
    if (opts.initial) {
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } else {
      await interaction.update({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    try { await interaction.reply({ embeds: [embed], components: [row], ephemeral: true }); } catch (e) { console.error('Erro ao enviar pergunta do quiz:', e); }
  }
}

async function onPass(interaction, score) {
  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);

    // remove cargo WL_ROLE_ID/ROLE_NO_REG_ID e adiciona REGISTERED_ROLE_ID se configurados
    if (CONFIG.WL_ROLE_ID && CONFIG.WL_ROLE_ID !== 'COLE_AQUI_WL_ROLE_ID') {
      try { if (member.roles.cache.has(CONFIG.WL_ROLE_ID)) await member.roles.remove(CONFIG.WL_ROLE_ID, 'Passou na WL - remover cargo com id'); } catch(e){ console.error('remove WL_ROLE', e); }
    }
    if (CONFIG.ROLE_NO_REG_ID && CONFIG.ROLE_NO_REG_ID !== 'COLE_AQUI_ROLE_NO_REG_ID') {
      try { if (member.roles.cache.has(CONFIG.ROLE_NO_REG_ID)) await member.roles.remove(CONFIG.ROLE_NO_REG_ID, 'Passou na WL - remover cargo sem registro'); } catch(e){ console.error('remove NO_REG', e); }
    }
    if (CONFIG.REGISTERED_ROLE_ID && CONFIG.REGISTERED_ROLE_ID !== 'COLE_AQUI_REGISTERED_ROLE_ID') {
      try { await member.roles.add(CONFIG.REGISTERED_ROLE_ID, 'Passou na WL - adicionar cargo registrado'); } catch(e){ console.error('add REGISTERED', e); }
    }

    // salva histórico no data.json
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
    try { await interaction.user.send(`Parabéns! Você foi aprovado na WL com ${score}/${QUIZ_QUESTIONS.length}. Você recebeu o cargo de registrado.`).catch(()=>{}); } catch(e){}

    // notificar staff channel (opcional)
    try {
      if (CONFIG.STAFF_CHANNEL_ID && CONFIG.STAFF_CHANNEL_ID !== 'COLE_AQUI_STAFF_CHANNEL_ID') {
        const ch = await interaction.guild.channels.fetch(CONFIG.STAFF_CHANNEL_ID).catch(()=>null);
        if (ch) await ch.send({ embeds: [ new EmbedBuilder().setTitle('WL - Usuário Aprovado').setDescription(`${interaction.user.tag} passou no quiz (${score}/${QUIZ_QUESTIONS.length})`).setColor('#2ecc71') ] }).catch(()=>{});
      }
    } catch (err) { console.error('Erro notify staff', err); }

    // responde ao usuário (ephemeral)
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.update({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Aprovado — ${score}/${QUIZ_QUESTIONS.length}`).setColor('#2ecc71') ], components: [] });
      } else {
        await interaction.reply({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Aprovado — ${score}/${QUIZ_QUESTIONS.length}`).setColor('#2ecc71') ], ephemeral: true });
      }
    } catch {
      try { await interaction.reply({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Aprovado — ${score}/${QUIZ_QUESTIONS.length}`).setColor('#2ecc71') ], ephemeral: true }); } catch {}
    }
  } catch (err) {
    console.error('onPass error', err && err.stack ? err.stack : err);
    try { if (!interaction.replied) await interaction.reply({ content: 'Erro ao processar aprovação.', ephemeral: true }); } catch {}
  }
}

async function onFail(interaction, score) {
  try {
    try { await interaction.user.send(`Você acertou ${score}/${QUIZ_QUESTIONS.length}. Não atingiu o mínimo de ${CONFIG.PASSING_SCORE || 4}. Tente novamente mais tarde.`).catch(()=>{}); } catch(e){}
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.update({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Reprovado — ${score}/${QUIZ_QUESTIONS.length}. Necessário ${CONFIG.PASSING_SCORE || 4}.`).setColor('#e74c3c') ], components: [] });
      } else {
        await interaction.reply({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Reprovado — ${score}/${QUIZ_QUESTIONS.length}. Necessário ${CONFIG.PASSING_SCORE || 4}.`).setColor('#e74c3c') ], ephemeral: true });
      }
    } catch {
      await interaction.reply({ embeds: [ new EmbedBuilder().setTitle('Resultado').setDescription(`Reprovado — ${score}/${QUIZ_QUESTIONS.length}. Necessário ${CONFIG.PASSING_SCORE || 4}.`).setColor('#e74c3c') ], ephemeral: true });
    }
  } catch (err) {
    console.error('onFail error', err && err.stack ? err.stack : err);
  }
}

module.exports = { setup, handleInteraction, CONFIG };