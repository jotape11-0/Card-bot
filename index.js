require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder
} = require("discord.js");

const DATA = path.join(__dirname, "cards.json");

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(DATA, "{}");
}

function load() {
  return JSON.parse(fs.readFileSync(DATA, "utf8"));
}

function save(data) {
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName("card")
    .setDescription("Mostra seu card ou o card de outro membro.")
    .addUserOption(option =>
      option
        .setName("membro")
        .setDescription("Membro que você quer ver")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("card-set")
    .setDescription("Salva seu card.")
    .addAttachmentOption(option =>
      option
        .setName("imagem")
        .setDescription("Imagem do seu card")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("card-remove")
    .setDescription("Remove seu card."),

  new SlashCommandBuilder()
    .setName("card-admin")
    .setDescription("Admin salva um card para um membro.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addUserOption(option =>
      option.setName("membro").setDescription("Membro").setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName("imagem").setDescription("Imagem do card").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("card-list")
    .setDescription("Mostra quantos cards existem no servidor.")
].map(command => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Comandos registrados!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cards = load();
  const guild = interaction.guildId;

  if (!guild) return;

  if (interaction.commandName === "card") {
    const user =
      interaction.options.getUser("membro") || interaction.user;

    const key = `${guild}:${user.id}`;
    const card = cards[key];

    if (!card) {
      return interaction.reply({
        content:
          user.id === interaction.user.id
            ? "❌ Você ainda não tem um card. Use `/card-set`."
            : `❌ ${user.username} ainda não tem um card.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `🃏 Card de **${user.username}**`,
      files: [
        new AttachmentBuilder(card.path, {
          name: card.name
        })
      ]
    });
  }

  if (interaction.commandName === "card-set") {
    const image = interaction.options.getAttachment("imagem");

    if (!image.contentType?.startsWith("image/")) {
      return interaction.reply({
        content: "❌ Envie uma imagem.",
        ephemeral: true
      });
    }

    const response = await fetch(image.url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const folder = path.join(__dirname, "cards");

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }

    const filename = `${guild}-${interaction.user.id}.png`;
    const file = path.join(folder, filename);

    fs.writeFileSync(file, buffer);

    cards[`${guild}:${interaction.user.id}`] = {
      path: file,
      name: filename
    };

    save(cards);

    return interaction.reply({
      content: "✅ Seu card foi salvo! Use `/card` para vê-lo.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "card-remove") {
    const key = `${guild}:${interaction.user.id}`;

    if (!cards[key]) {
      return interaction.reply({
        content: "❌ Você não possui um card salvo.",
        ephemeral: true
      });
    }

    try {
      if (fs.existsSync(cards[key].path)) {
        fs.unlinkSync(cards[key].path);
      }
    } catch {}

    delete cards[key];
    save(cards);

    return interaction.reply({
      content: "🗑️ Seu card foi removido.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "card-admin") {
    const user = interaction.options.getUser("membro");
    const image = interaction.options.getAttachment("imagem");

    if (!image.contentType?.startsWith("image/")) {
      return interaction.reply({
        content: "❌ Envie uma imagem.",
        ephemeral: true
      });
    }

    const response = await fetch(image.url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const folder = path.join(__dirname, "cards");

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }

    const filename = `${guild}-${user.id}.png`;
    const file = path.join(folder, filename);

    fs.writeFileSync(file, buffer);

    cards[`${guild}:${user.id}`] = {
      path: file,
      name: filename
    };

    save(cards);

    return interaction.reply({
      content: `✅ Card de **${user.username}** salvo!`
    });
  }

  if (interaction.commandName === "card-list") {
    const total = Object.keys(cards)
      .filter(key => key.startsWith(`${guild}:`))
      .length;

    return interaction.reply(
      `🃏 Existem **${total}** cards salvos neste servidor.`
    );
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("Token do Discord não configurado.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
