# CKBuilder Weekly Report - Week 17

**Name:** Nelly Njeri

**Week Ending:** 25 October 2026

## 1. Weekly Focus

This week was about running the private tally setup ceremony with real people:
making the first contribution myself, bringing in the next contributors, and
fixing every place in the guide where someone got stuck or could have.

By the end of the week two contributions had been verified and accepted, a third
contributor had started, and a fourth was waiting for her turn. Both finished
two days later (Section 5). I also learned
something about outreach that changed how I am running the rest of the ceremony
(Section 4).

## 2. Contributions So Far

On 20 October I published the initial key in the repository. It had been left
out by a `.gitignore` rule for key files, so the download link in the guide did
not work until then. The guide's status was changed to open the same day.

| # | Contributor | Accepted | Record |
| --- | --- | --- | --- |
| 1 | Xiaomao (me) | 20 October | Hash posted on [X](https://x.com/nellycyberpro/status/2112485476976431408); [commit](https://github.com/wamimi/noir-ckb-verifier/commit/8d91433) |
| 2 | truthixify | 25 October (contributed 23 October) | [commit](https://github.com/wamimi/noir-ckb-verifier/commit/7ae77d6) |
| 3 | alienate | Turn opened 25 October | In progress at the end of the week |
| 4 | CECILIA-MULANDI | Turn requested | Waiting for contribution 3 |

Each key was checked by the coordinator tool before acceptance: `snarkjs zkey
verify` against the frozen circuit and the phase 1 file, the contributor's name
and contribution hash as recorded inside the key, and that it builds on every
earlier contribution unchanged. Each acceptance is one commit containing the new
key, the updated transcript and the contributions table.

I made the first contribution under the same rules as everyone else, so the
chain does not start from a key only the coordinator has touched.

## 3. What Real Contributors Changed in the Guide

Going through the process as a contributor, and then watching others do it,
showed gaps that reading the guide had not. Each one was fixed the day it came
up:

- **Public attestation.** The guide now recommends posting the contribution hash
  on the contributor's own account (X, a Gist or a blog), with a ready template
  that fits in one X post. The issue thread lives in the coordinator's
  repository, where comments can be edited; a post on the contributor's own
  account cannot be changed by anyone else. It stays optional.
- **Expected download output.** The download step now shows what a correct
  `curl` result looks like, and says that a file of only a few hundred bytes
  means an error page was saved.
- **Commands that fail in zsh.** Command blocks with `# comments` after the
  commands fail in a default macOS zsh. They were split into separate blocks
  for Mac and Linux.
- **Why there are turns.** People asked why they could not just follow the guide.
  The guide now explains that each key builds on the previous one, so two people
  working from the same key would produce two competing next keys and one
  person's work would be thrown away. A turn simply reserves the next key.
- **How to ask for a turn.** A `Turn request: <name>` issue, a forum reply or a
  Telegram message. The coordinator renames the request issue into the
  contribution issue instead of opening a second one.
- **Where to paste the setup lines.** The guide and the generated issue text now
  say to open a new terminal window, paste the three `export` lines there, and
  do every following step in that same window. Those values exist only in that
  window, so closing it would make the download fail with an empty link.

## 4. Outreach

I shared the ceremony on Nervos Talk, in the CKB Telegram group, on X, and in
several Web3 and ZK WhatsApp communities.


## 5. Since the Week Ended

Both remaining contributions were completed and accepted on 27 October:
alienate ([commit](https://github.com/wamimi/noir-ckb-verifier/commit/dee824d))
and CECILIA-MULANDI
([commit](https://github.com/wamimi/noir-ckb-verifier/commit/bf09ccf)). The
ceremony now has **four verified contributions**, more than the minimum of three
needed to finalize.

Contribution 3 found two more gaps, both fixed in the guide: Step 4 now shows
the exact commands for setting `IN` and `OUT` again after closing the terminal,
and Step 1 no longer chains `mkdir` and `cd` with `&&`, which could leave a
contributor in the wrong folder when the folder already existed.

## 6. Ceremony Timeline

| Date | Step |
| --- | --- |
| By about 30 October | Last contributions |
| Around 1 November | CKB mainnet block 20,870,000 exists; its hash is applied as the beacon |
| After the beacon | Final key verified, verification key exported, full transcript published |

No contribution is accepted once the beacon block exists, and the tool refuses
one if the chain tip has reached it.

## 7. Next Steps and Questions

1. Accept any further contributions until about 30 October.
2. Apply the beacon, finalize, and publish the transcript and verification key.
3. Deploy the private tally on testnet with the ceremony key, and publish a demo
   and guide so others can create and update their own hidden tally.
4. Write the grant proposal while the ceremony finishes, so it can include the
   testnet results.

I would still welcome advice on reaching contributors in the CKB community, in
particular whether a live session, where several people contribute in a row with
someone walking them through it, has worked for others.

## References

- [Project repository](https://github.com/wamimi/noir-ckb-verifier)
- [Week 16 report](https://github.com/wamimi/CKBuilder/blob/main/ckbuilder-journey/reports/week-16.md)
- [Setup ceremony guide](https://github.com/wamimi/noir-ckb-verifier/blob/bf09ccf/docs/setup-ceremony.md)
- [Ceremony transcript](https://github.com/wamimi/noir-ckb-verifier/tree/main/ceremony/private-tally-v2)
- [Private tally v2 design](https://github.com/wamimi/noir-ckb-verifier/blob/bf09ccf/docs/private-tally-v2-spec.md)
- [Nervos Talk update](https://talk.nervos.org/t/noir-ckb-update-what-i-decided-after-the-direction-check-what-you-can-try-today-and-where-this-is-going/10968)
