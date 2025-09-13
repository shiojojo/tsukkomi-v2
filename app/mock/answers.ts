// mock answers: 15 topics × 2 answers = 30 entries
export const mockAnswers = [
  { id: 1, text: '猫が会議でのドヤ顔担当になる', author: 'Alice', created_at: '2025-09-01T09:10:00.000Z', topicId: 1, votes: { level1: 0, level2: 1, level3: 2 }, votesBy: { 'user-1': 3 } },
  { id: 2, text: '出勤はリモート、昼寝はフルタイム', author: 'Bob', created_at: '2025-09-01T09:11:00.000Z', topicId: 1, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 3, text: '引越し理由: 実は宝箱が見つかった', author: 'Alice', created_at: '2025-09-02T10:10:00.000Z', topicId: 2, votes: { level1: 0, level2: 2, level3: 1 }, votesBy: { 'user-1': 2 } },
  { id: 4, text: '引越し理由: 隣人が突然占い師になった', author: 'Bob', created_at: '2025-09-02T10:12:00.000Z', topicId: 2, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 5, text: 'どうでもいい発明: 靴下専用傘', author: 'Alice', created_at: '2025-09-03T11:05:00.000Z', topicId: 3, votes: { level1: 0, level2: 0, level3: 1 }, votesBy: { 'user-1': 3 } },
  { id: 6, text: 'どうでもいい発明: 猫耳ヘッドホン', author: 'Bob', created_at: '2025-09-03T11:06:00.000Z', topicId: 3, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 7, text: '居酒屋で言ってはいけない: ここで告白しようぜ', author: 'Alice', created_at: '2025-09-04T12:05:00.000Z', topicId: 4, votes: { level1: 0, level2: 1, level3: 0 }, votesBy: { 'user-1': 2 } },
  { id: 8, text: '居酒屋で言ってはいけない: 皿は全部私に', author: 'Bob', created_at: '2025-09-04T12:06:00.000Z', topicId: 4, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 9, text: '未来のコンビニ: 空飛ぶ冷蔵庫', author: 'Alice', created_at: '2025-09-05T13:05:00.000Z', topicId: 5, votes: { level1: 0, level2: 0, level3: 2 }, votesBy: { 'user-1': 3 } },
  { id: 10, text: '未来のコンビニ: 話すレジ', author: 'Bob', created_at: '2025-09-05T13:06:00.000Z', topicId: 5, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 11, text: 'ありえない自己紹介: 私、実は王族です', author: 'Alice', created_at: '2025-09-06T14:05:00.000Z', topicId: 6, votes: { level1: 0, level2: 1, level3: 1 }, votesBy: { 'user-1': 3 } },
  { id: 12, text: 'ありえない自己紹介: ロボットです', author: 'Bob', created_at: '2025-09-06T14:06:00.000Z', topicId: 6, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 13, text: 'ホテルでやってはいけない: ベッドでバーベキュー', author: 'Alice', created_at: '2025-09-07T15:05:00.000Z', topicId: 7, votes: { level1: 0, level2: 2, level3: 0 }, votesBy: { 'user-1': 2 } },
  { id: 14, text: 'ホテルでやってはいけない: ルームサービスを全部頼む', author: 'Bob', created_at: '2025-09-07T15:06:00.000Z', topicId: 7, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 15, text: '宇宙人: こんにちは、Wi-Fiはありますか？', author: 'Alice', created_at: '2025-09-08T16:05:00.000Z', topicId: 8, votes: { level1: 0, level2: 0, level3: 1 }, votesBy: { 'user-1': 3 } },
  { id: 16, text: '宇宙人: お土産はどこで買える？', author: 'Bob', created_at: '2025-09-08T16:06:00.000Z', topicId: 8, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 17, text: '言い訳: 犬が食べました（全部）', author: 'Alice', created_at: '2025-09-09T17:05:00.000Z', topicId: 9, votes: { level1: 0, level2: 1, level3: 0 }, votesBy: { 'user-1': 2 } },
  { id: 18, text: '言い訳: 実はタイムトラベルしてた', author: 'Bob', created_at: '2025-09-09T17:06:00.000Z', topicId: 9, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 19, text: 'ドラえもんの秘密: 実は未来の猫型AI', author: 'Alice', created_at: '2025-09-10T18:05:00.000Z', topicId: 10, votes: { level1: 0, level2: 0, level3: 2 }, votesBy: { 'user-1': 3 } },
  { id: 20, text: 'ドラえもんの秘密: ポケットはスーパーコンピュータ', author: 'Bob', created_at: '2025-09-10T18:06:00.000Z', topicId: 10, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 21, text: '失敗しない料理法: 全部レンジで解決', author: 'Alice', created_at: '2025-09-11T19:05:00.000Z', topicId: 11, votes: { level1: 0, level2: 1, level3: 0 }, votesBy: { 'user-1': 2 } },
  { id: 22, text: '失敗しない料理法: 砂糖を入れればOK', author: 'Bob', created_at: '2025-09-11T19:06:00.000Z', topicId: 11, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 23, text: '面接で言ってはいけない: ぶっちゃけ給料目的です', author: 'Alice', created_at: '2025-09-12T20:05:00.000Z', topicId: 12, votes: { level1: 0, level2: 0, level3: 1 }, votesBy: { 'user-1': 3 } },
  { id: 24, text: '面接で言ってはいけない: えーっと、特にないです', author: 'Bob', created_at: '2025-09-12T20:06:00.000Z', topicId: 12, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 25, text: '時間を戻す: 昨日の会議をやり直す', author: 'Alice', created_at: '2025-09-13T08:05:00.000Z', topicId: 13, votes: { level1: 0, level2: 2, level3: 0 }, votesBy: { 'user-1': 2 } },
  { id: 26, text: '時間を戻す: もっと寝る', author: 'Bob', created_at: '2025-09-13T08:06:00.000Z', topicId: 13, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 27, text: 'ペットが人間化: 朝ごはんを作ってくれる', author: 'Alice', created_at: '2025-09-13T12:05:00.000Z', topicId: 14, votes: { level1: 0, level2: 0, level3: 1 }, votesBy: { 'user-1': 3 } },
  { id: 28, text: 'ペットが人間化: SNSで炎上する', author: 'Bob', created_at: '2025-09-13T12:06:00.000Z', topicId: 14, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },

  { id: 29, text: 'スマホが喋る: 今日の天気は超晴れ', author: 'Alice', created_at: '2025-09-13T16:05:00.000Z', topicId: 15, votes: { level1: 0, level2: 1, level3: 1 }, votesBy: { 'user-1': 3 } },
  { id: 30, text: 'スマホが喋る: お金を使いすぎだよ', author: 'Bob', created_at: '2025-09-13T16:06:00.000Z', topicId: 15, votes: { level1: 1, level2: 0, level3: 0 }, votesBy: { 'user-2': 1 } },
];
