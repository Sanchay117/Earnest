# Evidence

Every transaction of the demo, generated from `evidence/<network>.json` by `node scripts/evidence.ts`. Most were
sent by the demo scripts; rows marked (live app) were sent from a browser wallet through the live app, and
recorded with `node scripts/record-tx.ts`.
Costs are gas paid in USDC (Arc's native gas token). A row marked REVERTED is an attack that was sent for real
and refused by the contract on chain.

## Arc Mainnet

- Earnest: [`0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3`](https://explorer.arc.io/address/0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3)
- Demo agent: ERC-8004 agent id 2730 ("Arc Block Digest")
- 33 transactions, $0.1358 of gas in total

| # | Step | Outcome | Transaction | Gas | Cost |
|---:|---|---|---|---:|---:|
| 1 | deploy Earnest | deployed at 0xea257f34207afd7c1dd16ea64764dbdc6ee7abc3 | [`0xba96a1ed…`](https://explorer.arc.io/tx/0xba96a1ed0d84a41e5b1e8653d465810d1780d11a1a031cba7f56e6dc9ee1ad66) | 2257119 | $0.045182 |
| 2 | fund client | sent $1.2 | [`0xa6773b85…`](https://explorer.arc.io/tx/0xa6773b85d324902ca79006c3806487d61416cd27a06d41e597bfa322f58b2d15) | 21000 | $0.000420 |
| 3 | fund agent | sent $0.05 | [`0xe01d2a64…`](https://explorer.arc.io/tx/0xe01d2a647b17cbeb5f8c5d508a0ce8f7f0f4acd3c25de56ff7cbeec4be9da2e5) | 21000 | $0.000420 |
| 4 | fund faker | sent $0.03 | [`0x82d62bbd…`](https://explorer.arc.io/tx/0x82d62bbd1659ae576523e0598051530e94498221d710e621d7196539c1b1f563) | 21000 | $0.000420 |
| 5 | register agent | ERC-8004 agent registered | [`0x96e7b21b…`](https://explorer.arc.io/tx/0x96e7b21b51f6b3e8df2f8749a53ddd7ae37ce3be4c6f1b7e6a21965433445b75) | 615399 | $0.012320 |
| 6 | create job | agent job for $0.5 | [`0x1ff95321…`](https://explorer.arc.io/tx/0x1ff95321f59df19aabd5b5381c3040cc9faa46f5cc7f1c71f70c08801a978d19) | 337408 | $0.006756 |
| 7 | approve | approved $0.5 | [`0xe27d2090…`](https://explorer.arc.io/tx/0xe27d2090f9e9c0a950cb5dbb46c03f46b22e333f6081a8d95f5a621ccce36851) | 55438 | $0.001110 |
| 8 | fund job 1 | escrowed $0.5 | [`0xb4e2741f…`](https://explorer.arc.io/tx/0xb4e2741fbd1055dfaff01ccccf6fb0f1ecaf58caf20677e63004e2feb1d41872) | 89200 | $0.001786 |
| 9 | submit job 1 | submitted digest | [`0xd03da15b…`](https://explorer.arc.io/tx/0xd03da15b6b5c57d7d3aa3c6121575d65b67459a299d586ba29fef954cb528e11) | 56095 | $0.001206 |
| 10 | complete job 1 | digest verified, paid, rated 100 | [`0x3b22f2d8…`](https://explorer.arc.io/tx/0x3b22f2d84cc523ffdcc9520fa9c84f7cdbb60a33de19b7cb8192ada9f06cab36) | 334126 | $0.006690 |
| 11 | create job | agent job for $0.25 | [`0x34bf9bb4…`](https://explorer.arc.io/tx/0x34bf9bb4afd7dc263750cf57a2ea97b0c6a86883c34e98d23baa13597fee96f0) | 320308 | $0.006416 |
| 12 | approve | approved $0.25 | [`0x5a8e800c…`](https://explorer.arc.io/tx/0x5a8e800c5caa7d0722c227f1bc0f277780f9a2e48ad1622b0810214f77f309a9) | 55438 | $0.001110 |
| 13 | fund job 2 | escrowed $0.25 | [`0x86d02b88…`](https://explorer.arc.io/tx/0x86d02b881c448719b1fd910a7522acae5eced0addd7ecb36452c239977619a0e) | 89200 | $0.001787 |
| 14 | create job | agent job for $0.25 | [`0x69d65280…`](https://explorer.arc.io/tx/0x69d6528031dac7b372a8e5567369e6fe818cb2dfae9ad5dc7534872cc6476926) | 320308 | $0.006415 |
| 15 | approve | approved $0.25 | [`0xe7e36fda…`](https://explorer.arc.io/tx/0xe7e36fda9e6d335d3b52568e21d6b3387d2ca88feb89a27f538fe7b479b6a2ac) | 55438 | $0.001110 |
| 16 | fund job 3 | escrowed $0.25 | [`0xdc43e2fe…`](https://explorer.arc.io/tx/0xdc43e2fe46031f4fe2e98800203a429e4789fb29f72aeebe7823fa4ab4decc5e) | 89200 | $0.001786 |
| 17 | submit job 3 | submitted a wrong digest (sabotage) | [`0x4bdaa237…`](https://explorer.arc.io/tx/0x4bdaa237e04f87fa75f4aa517b921b9dbd6998bbdf3715d8e0f5fef21d42b63f) | 56095 | $0.001124 |
| 18 | reject job 3 | digest mismatch, refunded | [`0xe8f1b03f…`](https://explorer.arc.io/tx/0xe8f1b03f750763457784104ef952087552c2dc754adaa6df63eb23ad02387bf6) | 70665 | $0.001418 |
| 19 | create job | agent job for $0.1 | [`0x3c76776a…`](https://explorer.arc.io/tx/0x3c76776a3ffcebd1587a58c7c2f5aaf595d59d334965b53946dcfa44becf1330) | 320296 | $0.006429 |
| 20 | approve | approved $0.1 | [`0xe9ae795c…`](https://explorer.arc.io/tx/0xe9ae795cf3d6844386c9bd7c37b4e8a5efdfae50a697d1141b331f156d60fd6c) | 55438 | $0.001113 |
| 21 | fund job 4 | escrowed $0.1 | [`0xdaeb4644…`](https://explorer.arc.io/tx/0xdaeb4644bcac300849277990e04e0a316d04942cae2df9239d4156c6cc1e9dd8) | 89200 | $0.001790 |
| 22 | submit job 4 | submitted digest | [`0x483647d8…`](https://explorer.arc.io/tx/0x483647d8ea254d4cd71ef69d041f43241e2166f2ed0108947fb7bff91b82ca75) | 56095 | $0.001126 |
| 23 | self-review job 4 | REVERTED: agent owner rated its own agent: SelfReview | [`0x8c156537…`](https://explorer.arc.io/tx/0x8c1565373bf58da7d2ba2030889ca3397db894a4ee3d20cc2f598a5166aee820) | 111439 | $0.002239 |
| 24 | fake review | unpaid 100/100 review written directly to the registry | [`0x6ccd3305…`](https://explorer.arc.io/tx/0x6ccd33050f3e589f081c6fa78539462cf8e317d553f5ffcf6242a14f2321a5d7) | 173252 | $0.003484 |
| 25 | fake review | unpaid 100/100 review written directly to the registry | [`0x81f8f40f…`](https://explorer.arc.io/tx/0x81f8f40fec6b4f22cbabe7311be582940642724a2d098eeb2c996d1f772af8b9) | 108508 | $0.002182 |
| 26 | fake review | unpaid 100/100 review written directly to the registry | [`0x203d1c37…`](https://explorer.arc.io/tx/0x203d1c37d70619ae7e6c568213681c65328230bf20fc9540c90f3e6bad23a02c) | 108508 | $0.002184 |
| 27 | refund job 2 | expired, budget returned to client | [`0x9f786e37…`](https://explorer.arc.io/tx/0x9f786e37d2191901694cdb1b91048a1e1c3661497a2ca9e8637de62d4f80db63) | 68682 | $0.001508 |
| 28 | fund agent (wallet) | sent $0.01 for gas | [`0xe374f47a…`](https://explorer.arc.io/tx/0xe374f47a3d6c62b7491845c97826884055edd1bb8bed6869ce0c92ffe455ba34) | 21000 | $0.000452 |
| 29 | create job (live app) | agent job for $0.050001, outside client | [`0xc680429b…`](https://explorer.arc.io/tx/0xc680429b6e8cbb79730323187c6363c967782b62bd03d14d36eaa22bd8caf803) | 320296 | $0.006886 |
| 30 | approve (live app) | approved $0.050001 | [`0x097d09f6…`](https://explorer.arc.io/tx/0x097d09f6e89303e6ac1432c122c444e49d1c0d76016998aee9e5c87dab58a291) | 55426 | $0.001229 |
| 31 | fund job 5 (live app) | escrowed $0.050001 | [`0x4010415f…`](https://explorer.arc.io/tx/0x4010415f7e458efa1760bb35ac3fbd0e4d6893f853a3601d5387fecf44d182a4) | 89188 | $0.001918 |
| 32 | submit job 5 | submitted digest | [`0x96b37940…`](https://explorer.arc.io/tx/0x96b37940f9106583d099e01424e104cebf16d1c3fbb0ba0b9d9b70683f37c5aa) | 56095 | $0.001123 |
| 33 | complete job 5 (live app) | digest verified, paid, rated 100 | [`0xc7d01ba7…`](https://explorer.arc.io/tx/0xc7d01ba78ee8b625d488019ef252a9eb94569b52905af958ea12b29c510959a7) | 217698 | $0.004681 |

## Arc Testnet

- Earnest: [`0x125e29bcc055d87fdaa6710c0b1596389bee781a`](https://explorer.testnet.arc.io/address/0x125e29bcc055d87fdaa6710c0b1596389bee781a)
- Demo agent: ERC-8004 agent id 897441 ("Arc Block Digest")
- 25 transactions, $0.1416 of gas in total

| # | Step | Outcome | Transaction | Gas | Cost |
|---:|---|---|---|---:|---:|
| 1 | deploy Earnest | deployed at 0x125e29bcc055d87fdaa6710c0b1596389bee781a | [`0x2d0dbdee…`](https://explorer.testnet.arc.io/tx/0x2d0dbdee861d3508feb74abe5312f56a97e39f713fa1f4568a3832c0b44ae98f) | 2257119 | $0.056428 |
| 2 | fund client | sent $1.2 | [`0xfa5a557c…`](https://explorer.testnet.arc.io/tx/0xfa5a557c6d41b4ad1b95ec1091dd808e673cc26e1133f298a371300457ec2cd3) | 21000 | $0.000525 |
| 3 | fund agent | sent $0.05 | [`0x7b6be38c…`](https://explorer.testnet.arc.io/tx/0x7b6be38c78ee1477b663ecdc1ce76c2ff34f766a77ec08e570341f2fea536347) | 21000 | $0.000525 |
| 4 | fund faker | sent $0.03 | [`0xbefe8c79…`](https://explorer.testnet.arc.io/tx/0xbefe8c79d2226179ea1e6c89cfe18aecd93c8160d4ae8de948fe0704f83bf9b2) | 21000 | $0.000525 |
| 5 | register agent | ERC-8004 agent registered | [`0xe31931e0…`](https://explorer.testnet.arc.io/tx/0xe31931e0549578ae043341e91945fa8a53e43f05716d88f81e5f594f38f2ccb6) | 615447 | $0.015386 |
| 6 | create job | agent job for $0.5 | [`0xca19a76f…`](https://explorer.testnet.arc.io/tx/0xca19a76fe1dbe80b9bee9871c13e0561edc5576cb71b319359a6fc3ba4b7aa8b) | 337420 | $0.008436 |
| 7 | approve | approved $0.5 | [`0x82639c3f…`](https://explorer.testnet.arc.io/tx/0x82639c3f2b852eddc6a88033c052811d0e8cdeee8644819c9c478ba524a1cdfe) | 55438 | $0.001386 |
| 8 | fund job 1 | escrowed $0.5 | [`0x82151020…`](https://explorer.testnet.arc.io/tx/0x82151020c7c245707dab14c2240d62893805c69e89530634927ef5f17c88c80e) | 89200 | $0.002230 |
| 9 | submit job 1 | submitted digest | [`0xfe7142d8…`](https://explorer.testnet.arc.io/tx/0xfe7142d8687eefa64fa6a5f085522aa97b9219804e315aea20a0f3f84d8bc1fd) | 56095 | $0.001402 |
| 10 | complete job 1 | digest verified, paid, rated 100 | [`0x4fd56188…`](https://explorer.testnet.arc.io/tx/0x4fd56188180aa7cbd0d6546702bf3f0a30b94851bb01c9fc5e72b28eb10cfa79) | 334126 | $0.008353 |
| 11 | create job | agent job for $0.25 | [`0x6cb37e90…`](https://explorer.testnet.arc.io/tx/0x6cb37e905bff71ae110f11480a3e46b9df91eb709ed46d759bbef24e083c4cec) | 320320 | $0.007223 |
| 12 | approve | approved $0.25 | [`0x658a2552…`](https://explorer.testnet.arc.io/tx/0x658a2552b87cc9e20360d340554403a4e083a312f0ce5761f607db4c9867ab24) | 55438 | $0.001136 |
| 13 | fund job 2 | escrowed $0.25 | [`0x0b7c2fda…`](https://explorer.testnet.arc.io/tx/0x0b7c2fda492676c5c10097f54fdfc1e85475a869c30243b2257cc3228c8234b4) | 89200 | $0.002011 |
| 14 | create job | agent job for $0.25 | [`0x8f59f6c6…`](https://explorer.testnet.arc.io/tx/0x8f59f6c6908280fb5f5fbc85981679ec9893e0ad65e1aa7e4bd899af6b27a1e9) | 320320 | $0.007808 |
| 15 | approve | approved $0.25 | [`0xb6fea8b5…`](https://explorer.testnet.arc.io/tx/0xb6fea8b565b817021269f20481b54308eb6774752ab613d5255893c507af2a05) | 55438 | $0.001250 |
| 16 | fund job 3 | escrowed $0.25 | [`0xdfb46c9a…`](https://explorer.testnet.arc.io/tx/0xdfb46c9aebe18e3ac20117f2bbb9a72981bb4055fac55f71eadf7e11e691823d) | 89200 | $0.002011 |
| 17 | submit job 3 | submitted a wrong digest (sabotage) | [`0x39092e73…`](https://explorer.testnet.arc.io/tx/0x39092e735c6b5fbae3d1da60d5a6e29b1f2754d9466a9f078aca1ef6e6af908b) | 56095 | $0.001402 |
| 18 | reject job 3 | digest mismatch, refunded | [`0x720c526b…`](https://explorer.testnet.arc.io/tx/0x720c526bda6f55b389f12e0a1c46b2d3cbc22f1d24dd135553599c7135765d96) | 70665 | $0.001767 |
| 19 | create job | agent job for $0.1 | [`0x77518f9b…`](https://explorer.testnet.arc.io/tx/0x77518f9bbdcfba014c7d6322244774c36a706937fcf00be4efdb1dcee9db0f27) | 320320 | $0.008008 |
| 20 | approve | approved $0.1 | [`0x0c53d253…`](https://explorer.testnet.arc.io/tx/0x0c53d2536809f04ba9c19e1af1ce66f2c8dd885516612c83cddc2eb33a1b64d8) | 55438 | $0.001386 |
| 21 | fund job 4 | escrowed $0.1 | [`0x51d621f7…`](https://explorer.testnet.arc.io/tx/0x51d621f78bb81ec3bac30bd1ad20283b762e9c2aa978c040bdcd4f412e8fc387) | 89200 | $0.002230 |
| 22 | submit job 4 | submitted digest | [`0x40c39ecc…`](https://explorer.testnet.arc.io/tx/0x40c39ecce55f0ab8620096a706c6dad171fc2f565c6412b19236844804d5d1bf) | 56095 | $0.001402 |
| 23 | self-review job 4 | REVERTED: agent owner rated its own agent: SelfReview | [`0xf5295303…`](https://explorer.testnet.arc.io/tx/0xf52953034dd9ac033e46874601766ec2e1c627b94eba135562d5021246073074) | 111439 | $0.002786 |
| 24 | fake review | unpaid 100/100 review written directly to the registry | [`0xacb25a7a…`](https://explorer.testnet.arc.io/tx/0xacb25a7a8b96bdeb6f0e57d3dafd7d4ca80cf20df73f1edd905efe23fd108f1d) | 173264 | $0.004332 |
| 25 | refund job 2 | expired, budget returned to client | [`0xa31b5c38…`](https://explorer.testnet.arc.io/tx/0xa31b5c38aa9a1ac69c14f4a141f75689fd6abb24005947c25d669622b18ebced) | 68682 | $0.001619 |
