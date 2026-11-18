import type { SceneState } from "./state";

export function extremeLanguage(userText: string): boolean {
  return /(?:我要|我想|准备|马上).{0,10}(?:自杀|自残|伤害自己|杀了|打死|报复)|(?:杀了你|打死你|弄死你)/u.test(userText);
}

export function escalationCue(userText: string, state: SceneState): string | null {
  if (extremeLanguage(userText)) {
    return "我们先停一下。这里是模拟，不需要把冲动带到现实；你可以暂停、降低强度，或现在结束。";
  }
  if (state.tension >= 72 || state.conflict >= 75 || /(?:气死|受够了|忍不了了|闭嘴|去死|[！!]{3,})/u.test(userText)) {
    return "这段对话有些紧绷。先缓一口气也可以；你可以降低强度，或者随时停下。";
  }
  return null;
}
