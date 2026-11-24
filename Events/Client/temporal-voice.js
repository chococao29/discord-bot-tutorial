const { ChannelType } = require("discord.js");

const CREATE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID; // channel that triggers temporary channel creation
const temporaryChannels = new Set(); // stores temporary channels created by this event

module.exports = {
  name: "voiceStateUpdate", // runs whenever a user changes their voice state
  async execute(oldState, newState) {
    try {
      // detects when the user enters the configured creation channel
      if (
        newState.channelId === CREATE_CHANNEL_ID &&
        oldState.channelId !== CREATE_CHANNEL_ID
      ) {
        const member = newState.member; // user who triggered the event
        const guild = newState.guild; // server where the channel is created
        const triggerChannel = newState.channel; // channel that acted as the trigger

        if (!member || !triggerChannel) return; // stop if required information is missing

        const channel = await guild.channels.create({
          name: `[🔊] Temporal: ${member.user.username}`.slice(0, 100), // unique name limited to 100 characters
          type: ChannelType.GuildVoice, // creates a voice channel
          parent: triggerChannel.parentId || undefined, // keeps the trigger channel's category
          permissionOverwrites: triggerChannel.permissionOverwrites.cache.map(
            (overwrite) => ({
              id: overwrite.id, // role or user receiving the permission
              allow: overwrite.allow, // allowed permissions
              deny: overwrite.deny, // denied permissions
              type: overwrite.type, // indicates whether this is a role or user permission
            }),
          ),
        });

        temporaryChannels.add(channel.id); // registers the channel as temporary

        try {
          await member.voice.setChannel(channel); // moves the user to the newly created channel
        } catch (error) {
          console.error("Error moving user.", error);

          temporaryChannels.delete(channel.id); // removes the registration if the user could not be moved

          await channel.delete().catch(() => {}); // deletes the unused channel without stopping the event
        }

        console.info(`created channel ${channel.name}`); // confirms that the temporary channel was created
      }

      // checks whether the user left a voice channel
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel; // voice channel the user left

        if (
          oldChannel &&
          temporaryChannels.has(oldChannel.id) &&
          oldChannel.members.size === 0
        ) {
          temporaryChannels.delete(oldChannel.id); // stops tracking the channel as temporary

          await oldChannel.delete().catch(console.error); // deletes the empty temporary channel

          console.info(`deleted channel ${oldChannel.name}`); // confirms that the temporary channel was deleted
        }
      }
    } catch (error) {
      console.error("Error in voiceStateUpdate.", error); // logs general event errors
    }
  },
};
