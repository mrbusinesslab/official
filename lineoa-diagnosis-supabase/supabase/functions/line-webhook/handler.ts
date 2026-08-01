import { getSession, createSession, updateSession, saveDiagnosisResult, Session } from './session.ts';
import { textMessage, buildQuestionFlex, buildResultFlex } from './line-messages.ts';
import { replyMessage } from './line-api.ts';
import { TRIGGER_KEYWORD, CONSULT_KEYWORD, ITEMS } from './questions.ts';
import { scoreByCategory } from './diagnosis.ts';

const WELCOME_MESSAGE =
  '哈囉！我是品牌診斷小幫手 🙋\n想快速了解自己目前的品牌現況嗎？\n\n請直接輸入「初步診斷」四個字，就可以開始 1 分鐘診斷測驗 ✨';

const QUIZ_START_MESSAGE = '初步診斷開始！接下來7題，每題選一個最符合的程度就好。';

const CONSULT_REPLY =
  '已經收到你想預約一對一診斷諮詢的訊息了 🙌\n我們這邊會直接在這個對話裡跟你聯繫，也可以先跟我們說說你目前最卡關的地方，我們先幫你看看方向。';

const IDLE_HINT = `輸入「${TRIGGER_KEYWORD}」就可以開始品牌診斷測驗囉 ✨`;

export async function handleEvent(event: any) {
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!userId || !replyToken) return;

  let messages: unknown[] = [];

  if (event.type === 'follow') {
    messages = await handleFollow(userId);
  } else if (event.type === 'message' && event.message?.type === 'text') {
    messages = await handleTextMessage(userId, event.message.text);
  } else if (event.type === 'postback') {
    messages = await handlePostback(userId, event.postback.data);
  } else {
    return;
  }

  if (messages.length === 0) return;
  await replyMessage(replyToken, messages);
}

async function handleFollow(userId: string) {
  let session = await getSession(userId);
  if (!session) session = await createSession(userId);
  return [textMessage(WELCOME_MESSAGE)];
}

async function handleTextMessage(userId: string, text: string) {
  let session = await getSession(userId);
  if (!session) session = await createSession(userId);

  const trimmed = text.trim();

  // 任何時候輸入關鍵字，都（重新）啟動診斷流程，方便重新測驗
  if (trimmed === TRIGGER_KEYWORD) {
    await updateSession(userId, { state: 'QUIZ', quiz_index: 0, quiz_answers: {} });
    return [textMessage(QUIZ_START_MESSAGE), buildQuestionFlex(0)];
  }

  // CTA 按鈕點擊後會送出這句話，不論目前在哪個狀態都直接回覆
  if (trimmed === CONSULT_KEYWORD) {
    return [textMessage(CONSULT_REPLY)];
  }

  if (session.state === 'QUIZ') {
    return [textMessage('請直接點擊上面的選項按鈕作答喔 👆')];
  }

  // IDLE（還沒開始）或 DONE（已完成）都用這句提示，引導對方輸入關鍵字
  return [textMessage(IDLE_HINT)];
}

async function handlePostback(userId: string, data: string) {
  const params = new URLSearchParams(data);
  const action = params.get('action');
  let session = await getSession(userId);
  if (!session) session = await createSession(userId);

  if (action === 'quiz_answer') {
    const qId = Number(params.get('q'));
    const rawVal = params.get('val');
    const val = rawVal === 'null' || rawVal === null ? null : Number(rawVal);

    const answers = { ...(session.quiz_answers || {}), [qId]: val };
    const nextIndex = session.quiz_index + 1;

    if (nextIndex < ITEMS.length) {
      await updateSession(userId, { quiz_answers: answers, quiz_index: nextIndex });
      return [buildQuestionFlex(nextIndex)];
    }

    // 最後一題，產生診斷結果
    await updateSession(userId, { quiz_answers: answers, quiz_index: nextIndex, state: 'DONE' });

    const scored = scoreByCategory(answers);
    const worstCategory = scored.length > 0 ? scored[0].cat : null;
    const overallPct = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + c.pct, 0) / scored.length) : null;

    await saveDiagnosisResult({ userId, worstCategory, overallPct, answers });

    return [buildResultFlex(answers)];
  }

  if (action === 'request_consult') {
    // 不導去任何外部連結，訊息會直接進到 LINE 官方帳號後台的聊天室，
    // 你可以在原本的對話裡人工接手回覆
    return [
      textMessage(
        '已經收到你想預約一對一診斷諮詢的訊息了 🙌\n我們這邊會直接在這個對話裡跟你聯繫，也可以先跟我們說說你目前最卡關的地方，我們先幫你看看方向。',
      ),
    ];
  }

  return [];
}
