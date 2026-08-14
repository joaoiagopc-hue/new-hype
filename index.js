// parte do index.js - handler para !id
const fs = require('fs');
const path = require('path');
// ... seu client e intents já definidos

const DATA_FILE = path.join(__dirname, 'data.json'); // garante que é o mesmo arquivo usado pelo WL

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const init = { nextId: 1000, applications: {}, ids: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!data.ids) data.ids = {};
  if (typeof data.nextId !== 'number') data.nextId = Number(data.nextId) || 1000;
  return data;
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// trunca nickname pra <= 32 chars
function makeNickname(id, name) {
  const base = `${id} | ${name}`;
  if (base.length <= 32) return base;
  const idLen = String(id).length;
  const maxNameLen = 32 - (idLen + 3); // " | " = 3 chars
  const shortName = name.slice(0, Math.max(0, maxNameLen));
  return `${id} | ${shortName}`;
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (cmd === 'id') {
    const guild = message.guild;
    if (!guild) return message.reply({ content: 'Este comando só funciona em servidor (guild).', ephemeral: true });

    const member = message.member; // GuildMember do autor
    if (!member) return message.reply({ content: 'Não consegui obter seu membro no servidor.', ephemeral: true });

    // carrega data
    const data = loadData();

    // verifica se já tem ID em data.ids
    let assigned = data.ids[member.id];
    if (!assigned) {
      // se não tem, atribui nextId
      assigned = data.nextId || 1000;
      data.nextId = (Number(data.nextId) || 1000) + 1;
      if (!data.ids) data.ids = {};
      data.ids[member.id] = assigned;
      saveData(data);
    }

    // prepara novo nickname
    const currentName = (member.nickname || member.user.username);
    const newNick = makeNickname(assigned, currentName);

    // tenta setar nickname se necessário
    let nickChanged = false;
    try {
      // só tenta mudar se for diferente
      if (member.manageable && member.nickname !== newNick) {
        await member.setNickname(newNick, `ID assigned/confirmed by !id command`);
        nickChanged = true;
      }
    } catch (err) {
      console.error('Falha ao alterar nickname', err);
      // se não deu pra mudar, apenas continua e informa o usuário
    }

    // resposta para o usuário
    if (nickChanged) {
      return message.reply(`✅ Seu ID é **${assigned}** — nickname atualizado para: \`${newNick}\`.`);
    } else {
      return message.reply(`✅ Seu ID é **${assigned}**. ${member.manageable ? '' : '(Não consegui alterar o nickname automaticamente.)'}`);
    }
  }
});