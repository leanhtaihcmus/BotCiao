const bodyParser = require('body-parser');
const config = require('config');
const crypto = require('crypto');
const express = require('express');
const https = require('https');
const request = require('request');

var app = express();
app.set('port', process.env.PORT);
app.set('view engine', 'ejs');
app.use(bodyParser.json({verify: verifyRequestSignature }));
app.use(express.static('public'));

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSAGE_APP_SECRET) ? process.env.MESSAGE_APP_SECRET : config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSAGE_VALIDATION_TOKEN) ? process.env.MESSAGE_VALIDATION_TOKEN : config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TONE = (process.env.MESSAGE_PAGE_ACCESS_TOKEN) ? process.env.MESSAGE_PAGE_ACCESS_TOKEN : config.get('pageAccessToken');

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address.
const SERVER_URL = (process.env.SERVER_URL) ? process.env.SERVER_URL : config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TONE && SERVER_URL)) {
  console.error('Missing config values');
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subcribe' && 
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
        console.log('validating webhook');
        res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error('Failed validation. make sure the validation tokens match.');
    res.sendStatus(403);
  }
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function(req, res) {
  var data = req.body;

  // make sure this is a subcription page
  if (data.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else {
          console.log("Webhook received unkow event: ", event);
        }
      });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);

    }); 
  }
});


function receivedMessage(event) {

  var senderID = event.sender.id;
  var receipientID = event.receipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message: ", senderID, receipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageID = message.id;
  var messageText = message.text;
  var messageAttachments = message.attachments;

  if (messageText) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the example. Otherwise, just echo the text we received.
    switch(messageText) {
      case 'generic':
        sendGenericMesseage(senderID);
        break;
      
      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments){
    sendTextMessage(senderID, "Message with attachment received");
  }
}

// Handle for generic message
function sendGenerecMessage(receipientId, messageText) {

}

function sendTextMessage(receipientId, messageText) {
  var messageData = {
    receipient: {
      id: receipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TONE },
    method: 'POST',
    json: messageData
  }, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var receipientId = body.receipient_id;
      var messageId = body.message_id;
      
      console.log("Sucsessfully sent generic message with id %s to receipient %s", messageId, receipientId);
    } else {
      console.error("Unable to send message");
      console.error(response);
      console.error(error);
    }
  });
}