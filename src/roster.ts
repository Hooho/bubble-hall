// Identity snapshot from DEZHOU. Gameplay abilities belong to Bubble Club only.
export const identities = [{"id":0,"name":"女娲"},{"id":5,"name":"赵云"},{"id":23,"name":"普京"},{"id":28,"name":"牛顿"},{"id":31,"name":"李白"},{"id":36,"name":"C罗"},{"id":49,"name":"马云"},{"id":64,"name":"鲁迅"},{"id":65,"name":"苏轼"},{"id":66,"name":"周杰伦"},{"id":82,"name":"张国荣"},{"id":89,"name":"雷军"},{"id":98,"name":"巴菲特"},{"id":101,"name":"马斯克"},{"id":121,"name":"比尔·盖茨"},{"id":123,"name":"王维"},{"id":124,"name":"武则天"},{"id":129,"name":"刘备"},{"id":130,"name":"贝多芬"},{"id":137,"name":"王菲"},{"id":143,"name":"迈克尔·乔丹"},{"id":153,"name":"唐僧"},{"id":154,"name":"梅西"},{"id":156,"name":"勒布朗·詹姆斯"},{"id":161,"name":"莫扎特"},{"id":166,"name":"周星驰"},{"id":168,"name":"章子怡"},{"id":169,"name":"李嘉诚"},{"id":175,"name":"杜甫"},{"id":176,"name":"爱因斯坦"},{"id":182,"name":"斯蒂芬·库里"},{"id":185,"name":"白居易"},{"id":193,"name":"孙悟空"},{"id":209,"name":"孔子"},{"id":214,"name":"诸葛亮"},{"id":218,"name":"成龙"},{"id":220,"name":"屈原"},{"id":227,"name":"科比·布莱恩特"},{"id":235,"name":"梵高"},{"id":238,"name":"迈克尔·杰克逊"},{"id":242,"name":"乔布斯"},{"id":243,"name":"项羽"},{"id":247,"name":"莎士比亚"},{"id":268,"name":"特朗普"},{"id":279,"name":"关羽"},{"id":281,"name":"周润发"},{"id":282,"name":"秦始皇"},{"id":284,"name":"朱元璋"},{"id":292,"name":"奥巴马"},{"id":295,"name":"刘德华"},{"id":300,"name":"李清照"},{"id":307,"name":"李连杰"},{"id":308,"name":"金城武"},{"id":309,"name":"谢霆锋"},{"id":310,"name":"陈冠希"},{"id":311,"name":"王力宏"},{"id":313,"name":"高市早苗"},{"id":314,"name":"朱棣"},{"id":315,"name":"朱允炆"},{"id":316,"name":"林青霞"},{"id":317,"name":"张曼玉"},{"id":320,"name":"泰勒·斯威夫特"},{"id":321,"name":"马化腾"}] as const;
export type Personality = 'brave' | 'careful' | 'collector';
export const roster = identities.map((identity, index) => ({
  id: String(identity.id), name: identity.name,
  personality: (['brave', 'careful', 'collector'] as const)[index % 3],
  intelligence: 1 + ((identity.id * 7 + index) % 5),
  color: [0xe15c70, 0x27a6d9, 0x6378d8, 0x42b69a, 0xd9a330][index % 5],
}));
export type Contestant = typeof roster[number];
export const playerName = (id: string) => id === 'player' ? '你' : roster.find(p => p.id === id)?.name ?? '未知选手';
export const personalityName = { brave: '追击型', careful: '生存型', collector: '收集型' };
