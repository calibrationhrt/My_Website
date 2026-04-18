import axios from "axios";

const ACCESS_TOKEN = "K/06f3u1qxssTn0eN8pALzRzykbAhdUgpRcXpmASLN3/6q6ouOOyLZVY+twCfpbezxK2DOorsuzJz2fFLUNjvz8a44/lMqfv0P0Gus1OT0pnRax46UFTrYdY77j+wk+kEQn3y47vAL0/ZU45ymGPegdB04t89/1O/w1cDnyilFU=";
const GROUP_ID = "Cf32b7901d6a41722b42aeab74c3e2ef0";

async function sendLine() {
  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: GROUP_ID,
      messages: [
        {
          type: "text",
          text: "🚨 แจ้งเตือนทดสอบ: ระบบใช้งานได้แล้ว!"
        }
      ]
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    }
  );

  console.log("ส่งสำเร็จ");
}

sendLine();