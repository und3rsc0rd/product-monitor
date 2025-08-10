# product monitor
monitors [the deadAir store](https://deadair.store) and [underscores market](https://market.underscores.plus) for new products, and monitors [the underscores website](https://underscores.plus) for new live/DJ performances. it does this by web scraping (since there is unfortunately no public API to look at this stuff </3)

we use this in a staff-only channel on [underscord](https://discord.gg/UeWkrt7XTD)! it's private because the main author (Sadie) does not trust that her code won't fuck up at some point. web scraping is also inherently fragile - if a website layout changes too drastically, this code WILL break. this monitor is just to keep us alert in case any of us miss something!

powered by GitHub Actions and pure Node.js (no dependencies... yet?). depends on a `DISCORD_WEBHOOK_URLS` repository secret - if you want to run this locally, create an environment variable instead.

## license
```
   Copyright 2025 The underscord Staff, et al.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```
