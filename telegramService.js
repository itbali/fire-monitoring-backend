const https = require('https')

/**
 * Send notification to Telegram channel
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat/channel ID
 * @param {string} message - Message text
 * @param {Array<Array<number>>} evacuationPoints - Array of [lat, lng] coordinates
 * @param {Array<number>} location - [lat, lng] of the notification location
 * @returns {Promise<Object>} - Response from Telegram API
 */
async function sendTelegramNotification(botToken, chatId, message, evacuationPoints = [], location = null) {
  if (!botToken || !chatId) {
    throw new Error('Telegram bot token and chat ID are required');
  }

  // Format evacuation points
  let evacuationText = '';
  if (evacuationPoints && evacuationPoints.length > 0) {
    evacuationText = '\n\n📍 Safe Evacuation Points:\n';
    evacuationPoints.forEach((point, index) => {
      const [lat, lng] = point;
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      evacuationText += `${index + 1}. ${lat.toFixed(6)}, ${lng.toFixed(6)}\n   ${mapsUrl}\n`;
    });
  }

  // Add location if provided
  let locationText = '';
  if (location && location.length === 2) {
    const [lat, lng] = location;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    locationText = `\n\n📍 Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n${mapsUrl}`;
  }

  const fullMessage = `${message}${locationText}${evacuationText}`;

  // Telegram Bot API endpoint
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const postData = JSON.stringify({
    chat_id: chatId,
    text: fullMessage,
    parse_mode: 'HTML',
    disable_web_page_preview: false
  });

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            resolve({
              success: true,
              messageId: response.result.message_id,
              chat: response.result.chat
            });
          } else {
            reject(new Error(`Telegram API error: ${response.description || 'Unknown error'}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Telegram response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Telegram request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  sendTelegramNotification
}
