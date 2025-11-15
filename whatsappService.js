const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Global state
let whatsappClient = null;
let isLoggedIn = false;
let groupChat = null;
let qrCodeData = null;

// Channels
let channels = [];
let selectedChannel = null;

/** Status getters */
function getLoginStatus() { return isLoggedIn; }
function getGroupChat() { return groupChat; }
function getQRCode() { return qrCodeData; }
function getChannels() { return channels; }
function getSelectedChannel() { return selectedChannel; }

/**
 * Select channel by name (exact match) or by full id (_serialized or @newsletter jid)
 * @param {string} channelNameOrId
 * @returns {object|null}
 */
function setSelectedChannel(channelNameOrId) {
  if (!channels || channels.length === 0) return null;

  // Try by exact id first
  let ch = channels.find(c => c?.id?._serialized === channelNameOrId || c?.id?.user === channelNameOrId);
  if (!ch) {
    // Try by @newsletter JID format
    ch = channels.find(c => (`${c?.id?._serialized}` === `${channelNameOrId}`) ||
                             (`${c?.id?.user}@newsletter` === `${channelNameOrId}`));
  }
  if (!ch) {
    // Try by name (exact)
    ch = channels.find(c => c?.name === channelNameOrId);
  }
  selectedChannel = ch || null;
  return selectedChannel;
}

/**
 * Initialize the WhatsApp client
 * @param {string|null} groupName            Optional: group name to bind
 * @param {string|null} channelNameOrId      Optional: channel name or @newsletter id to bind
 * @returns {Promise<Client>}
 */
async function initializeWhatsAppClient(groupName = null, channelNameOrId = null) {
  if (whatsappClient) return whatsappClient;

  whatsappClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.resolve(__dirname, '../.wwebjs_auth')
    }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true
    }
  });

  whatsappClient.on('qr', async (qr) => {
    console.log('QR RECEIVED - Please scan with your phone');
    try {
      qrCodeData = await qrcode.toDataURL(qr);
      const qrCodeTerminal = await qrcode.toString(qr, { type: 'terminal', small: true });
      console.log(qrCodeTerminal);
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  });

  whatsappClient.on('authenticated', () => {
    console.log('AUTHENTICATED - Session data saved');
    qrCodeData = null;
    isLoggedIn = true;
  });

  whatsappClient.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
    isLoggedIn = false;
  });

  whatsappClient.on('ready', async () => {
    console.log('WhatsApp client is ready!');
    isLoggedIn = true;

    // 1) Bind group if provided
    if (groupName) {
      try {
        const chats = await whatsappClient.getChats();
        groupChat = chats.find(chat => chat.isGroup && chat.name === groupName) || null;
        if (!groupChat) console.error(`❌ Group "${groupName}" not found`);
        else console.log(`🎯 Group found: ${groupChat.name}`);
      } catch (err) {
        console.error('Error finding group:', err);
      }
    }

    // 2) Load channels
    try {
      channels = await whatsappClient.getChannels(); // requires recent whatsapp-web.js
      console.log(`📡 Channels loaded: ${channels.length}`);

      // auto-select channel if requested
      if (channelNameOrId) {
        const ch = setSelectedChannel(channelNameOrId);
        if (ch) console.log(`🔔 Channel selected: ${ch.name} (${ch.id?._serialized}) | readOnly=${!!ch.isReadOnly}`);
        else console.warn(`⚠️ Channel "${channelNameOrId}" not found or not visible to this session`);
      }
    } catch (err) {
      console.error('Error loading channels:', err);
    }
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log(`🔌 Disconnected from WhatsApp. Reason: ${reason || 'Unknown'}`);
    isLoggedIn = false;
  });

  await whatsappClient.initialize();
  return whatsappClient;
}

/**
 * Send notification to WhatsApp (channel / group / direct)
 * Priority: phoneNumber -> channel (id/name) -> bound group
 * @param {string} message
 * @param {Array<[number, number]>} evacuationPoints
 * @param {[number, number]|null} location
 * @param {Object} opts
 * @param {string|null} opts.phoneNumber         E.164-like (with or without +)
 * @param {string|null} opts.channelId           Full serialized id or @newsletter JID
 * @param {string|null} opts.channelName         Exact channel name
 * @param {Buffer|string|null} opts.mediaPath    Optional local file path for media
 * @param {string|null} opts.mediaMime           e.g. 'image/png', 'video/mp4'
 * @returns {Promise<{success:boolean,messageId:string,timestamp:number}>}
 */
async function sendWhatsAppNotification(
  message,
  evacuationPoints = [],
  location = null,
  opts = {}
) {
  if (!whatsappClient) throw new Error('WhatsApp client is not initialized. Please initialize it first.');
  if (!isLoggedIn) throw new Error('WhatsApp client is not logged in. Please scan QR code first.');

  const { phoneNumber = null, channelId = null, channelName = null, mediaPath = null, mediaMime = null } = opts;

  // Build extra text blocks
  let evacuationText = '';
  if (Array.isArray(evacuationPoints) && evacuationPoints.length > 0) {
    evacuationText = '\n\n📍 *Safe Evacuation Points:*\n' + evacuationPoints.map((p, i) => {
      const [lat, lng] = p;
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      return `${i + 1}. ${lat.toFixed(6)}, ${lng.toFixed(6)}\n   ${mapsUrl}`;
    }).join('\n');
  }

  let locationText = '';
  if (Array.isArray(location) && location.length === 2) {
    const [lat, lng] = location;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    locationText = `\n\n📍 *Location:* ${lat.toFixed(6)}, ${lng.toFixed(6)}\n${mapsUrl}`;
  }

  const fullMessage = `${message}${locationText}${evacuationText}`;

  try {
    let chatId = null;

    if (phoneNumber) {
      // Direct chat
      const formatted = phoneNumber.replace(/[^0-9]/g, '');
      const numberId = await whatsappClient.getNumberId(formatted);
      if (!numberId) throw new Error(`Number ${formatted} is not on WhatsApp`);
      chatId = numberId._serialized; // safer than `${formatted}@c.us`
    } else {
      // Try channel
      let channelTarget = null;

      if (channelId) {
        // Accept raw serialized or @newsletter
        channelTarget = channels.find(c =>
          c?.id?._serialized === channelId ||
          `${c?.id?.user}@newsletter` === channelId
        ) || null;
      } else if (channelName) {
        channelTarget = channels.find(c => c?.name === channelName) || null;
      } else if (selectedChannel) {
        channelTarget = selectedChannel;
      }

      if (channelTarget) {
        if (channelTarget.isReadOnly) {
          throw new Error(`Channel "${channelTarget.name}" is read-only for this account`);
        }
        chatId = channelTarget.id._serialized; // Channel JID
      } else if (groupChat) {
        // Fallback to bound group
        chatId = groupChat.id._serialized;
      } else {
        throw new Error('No destination provided: phoneNumber, channel, or group not set');
      }
    }

    // Prepare optional media
    let payload = fullMessage;
    if (mediaPath) {
      const media = MessageMedia.fromFilePath(mediaPath);
      if (mediaMime && media.mimetype !== mediaMime) {
        // не обязательно, но можно проверить/логировать
        console.warn(`MIME mismatch: given ${mediaMime}, detected ${media.mimetype}`);
      }
      payload = media;
    }

    const sentMessage = await whatsappClient.sendMessage(chatId, payload, mediaPath ? { caption: fullMessage } : undefined);

    return {
      success: true,
      messageId: sentMessage.id._serialized,
      timestamp: sentMessage.timestamp
    };
  } catch (err) {
    throw new Error(`Failed to send WhatsApp message: ${err.message}`);
  }
}

/** Get WhatsApp client status */
function getStatus() {
  return {
    isLoggedIn,
    hasClient: !!whatsappClient,
    hasGroup: !!groupChat,
    groupName: groupChat?.name || null,
    hasChannels: Array.isArray(channels) && channels.length > 0,
    selectedChannel: selectedChannel ? { name: selectedChannel.name, id: selectedChannel.id?._serialized, isReadOnly: !!selectedChannel.isReadOnly } : null,
    qrCode: qrCodeData
  };
}

module.exports = {
  initializeWhatsAppClient,
  sendWhatsAppNotification,
  getStatus,
  getQRCode,
  getLoginStatus,
  getGroupChat,
  // channels API
  getChannels,
  getSelectedChannel,
  setSelectedChannel
};
