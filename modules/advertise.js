const config = require("../config.json");
const util = require("./util.js");

var client;

exports.init = (cl) => {
	client = cl;
}

exports.onCommand = async (message, command, args) => {
	//guild-only command
	if (!message.guild) return;

	//get channels to ensure module is functional
	let queueChannel = util.getChannel(config.advertise.channel_queue);
	let publishChannel = util.getChannel(config.advertise.channel_publish);
	if (!queueChannel || !publishChannel)
	{
		return;
	}

	//delete command
	if (config.delete_commands) {
		util.deleteMessage(message);
	}

	//ensure all arguments are specified
	if (args.length < 2) {
		return util.sendMessage(message.channel, `Invalid command usage: \`!${command} [invite] [description]\``, true);
	}

	//check if invite is valid
	let invite = await client.fetchInvite(args.shift()).catch(err => {
		util.sendMessage(message.channel, "Please provide a valid invite", true);
	});
	if (!invite) return;

	//form description
	let description = util.sanitize(args.join(" "));

	//send queue message
	let queueMessage = await queueChannel.send(`Invite: discord.gg/${invite.code}\nMember: ${message.author.toString()}\nDescription: ${description}`).catch(err => {
		console.log(`ERROR: Couldn't send message in #${message.channel.name} - ${err.message}`);
	});
	if (queueMessage) {
		util.sendMessage(message.channel, "Your advertisement request has been sent and is now waiting for approval", true);
	} else {
		return util.sendMessage(message.channel, "Unable to send advertisement request. Please try again later", true);
	}

	//add emoji to queue message
	const emoji = [config.advertise.accept_emoji, config.advertise.reject_emoji];
	for (let e of emoji) {
		await queueMessage.react(e);
	}

	//listen for reaction
	const filter = (reaction, user) => emoji.includes(reaction.emoji.name) && user.id != client.user.id;
	const collector = queueMessage.createReactionCollector(filter, { max: 1 });
	collector.on("collect", reaction => {
		let accepted = reaction.emoji.name === emoji[0];

		if (accepted) {
			//accept invite
			util.sendMessage(publishChannel, `Invite: discord.gg/${invite.code}\nDescription: ${description}`);
		}

		//do something to show it is resolved
		if (config.advertise.delete_resolved_invites) {
			util.deleteMessage(queueMessage);
		} else {
			queueMessage.clearReactions();
			util.editMessage(queueMessage, `${queueMessage.content}\nOutcome: ${accepted ? "Accepted" : "Declined"}`);
		}
	});
}