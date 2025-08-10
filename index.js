#!/usr/bin/env node
/**
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
**/
const fs = require('fs');

if (fs.existsSync('./data/djResult.json')) fs.writeFileSync('./data/djResultOld.json', fs.readFileSync('./data/djResult.json'));
if (fs.existsSync('./data/liveResult.json')) fs.writeFileSync('./data/liveResultOld.json', fs.readFileSync('./data/liveResult.json'));
if (fs.existsSync('./data/deadAirStore.json')) fs.writeFileSync('./data/deadAirStoreOld.json', fs.readFileSync('./data/deadAirStore.json'));
if (fs.existsSync('./data/underscoresMarket.json')) fs.writeFileSync('./data/underscoresMarketOld.json', fs.readFileSync('./data/underscoresMarket.json'));

var DISCORD_WEBHOOK_URLS = JSON.parse(process.env.DISCORD_WEBHOOK_URLS);

function getShopify(domain, page) {
  return fetch(
    `https://${domain}/collections/all?filter.v.availability=1&page=${page}`,
  )
    .then((response) => response.text())
    .then((data) => {
      const startIndex = data.indexOf("var meta = ");
      const endIndex = data.indexOf("for (var attr in meta) {");
      const jsonString = data.substring(startIndex, endIndex).trim();
      eval(jsonString);
      return meta;
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
    });
}
async function runGetShopify(domain) {
  let page = 1;
  let allData = [];
  while (true) {
    var data = await getShopify(domain, page);
    data = data && data.products ? data.products : [];
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    page++;
  }
  return [...allData];
}
Promise.all([
  runGetShopify("deadair.store")
    .then((data) => {
      fs.writeFileSync('./data/deadAirStore.json', JSON.stringify(data.filter((item) => item.vendor === "underscores"), null, 2));
      return data.filter((item) => item.vendor === "underscores");
    })
    .catch((error) => {
      console.error("Error in runGetShopify (deadAir):", error);
      return [];
    }),
  runGetShopify("market.underscores.plus")
    .then((data) => {
      fs.writeFileSync('./data/underscoresMarket.json', JSON.stringify(data, null, 2));
      return data;
    })
    .catch((error) => {
      console.error("Error in runGetShopify (underscores market):", error);
      return [];
    }),
])
  .then(([deadAir, underscoresMarket]) => {
    // Compare the old and new data
    const oldDeadAir = JSON.parse(fs.readFileSync('./data/deadAirStoreOld.json', 'utf8'));
    const oldUnderscoresMarket = JSON.parse(fs.readFileSync('./data/underscoresMarketOld.json', 'utf8'));
    const allOldProducts = [...oldDeadAir, ...oldUnderscoresMarket];
    const allNewProducts = [...deadAir, ...underscoresMarket];

    const productUpdatesAndAdditions = allNewProducts.map(item => {
      const oldItem = allOldProducts.find(old => old.id === item.id);
      if (!oldItem) {
        return { ...item, status: 'new' };
      }
      if (oldItem.variants[0].price !== item.variants[0].price) {
        return { ...item, status: 'updated', oldPrice: oldItem.variants[0].price };
      }
      return null;
    }).filter(Boolean);

    const productRemovals = allOldProducts
      .filter(oldItem => !allNewProducts.some(item => item.id === oldItem.id))
      .map(item => ({ ...item, status: 'removed' }));

    const allProductChanges = [...productUpdatesAndAdditions, ...productRemovals];

    if (allProductChanges.length > 0) {
      DISCORD_WEBHOOK_URLS.forEach((DISCORD_WEBHOOK_URL) => {
        fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Product Changes',
            embeds: allProductChanges.map(item => {
              let priceString;
              let color;
              
              if (item.status === 'removed') {
                priceString = `$${item.variants[0].price / 100}`;
                color = 15548997; // Red
              } else if (item.status === 'updated') {
                priceString = `$${item.oldPrice / 100} -> $${item.variants[0].price / 100}`;
                color = 16705372; // Yellow
              } else { // New
                priceString = `$${item.variants[0].price / 100}`;
                color = 5763719; // Green
              }

              return {
                title: item.variants[0].name,
                description: `Status: ${item.status}`,
                color: color,
                fields: [
                  { name: 'Price', value: priceString, inline: true },
                ],
              };
            }),
          }),
        });
      });
    }
  })
  .catch((error) => {
    console.error("Error while getting Shopify products:", error);
  });

async function getLiveDJSections() {
  try {
    const response = await fetch("https://underscores.plus/");
    var res = await response.text();
    let startIndex, endIndex, djData, liveData;
    let djResult = [],
      liveResult = [];

    if (res.indexOf(`\\">Live<\\/font>`) > -1) {
      console.log("Found Live section");
      let data = res;
      startIndex = data.indexOf(`\\">Live<\\/font>`) + 15;
      data = data.substring(startIndex + 7);
      endIndex = data.indexOf('"content_no_html":');
      data = data.substring(0, endIndex - 2).trim();
      if (data.indexOf(`\\">DJ<\\/font>`) > -1) {
        endIndex = data.indexOf(`\\">DJ<\\/font>`);
        liveData = data.substring(0, endIndex + 48).trim();
      } else liveData = data.trim();
      console.log(liveData)
    }

    if (res.indexOf(`\\">DJ<\\/font>`) > -1) {
      console.log("Found DJ section");
      let data = res;
      startIndex = data.indexOf(`\\">DJ<\\/font>`) + 20;
      data = data.substring(startIndex + 7);
      endIndex = data.indexOf('"content_no_html":');
      data = data.substring(0, endIndex - 2).trim();
      if (data.indexOf(`\\">Live<\\/font>`) > -1) {
        endIndex = data.indexOf(`\\">Live<\\/font>`);
        djData = data.substring(0, endIndex - 50).trim();
      } else djData = data.trim();
    }

    if (liveData) {
      const liveInfo = liveData
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/\\\//g, "/")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/grid-col="[^"]*"/g, "")
        .replace(/grid-pad="[^"]*"/g, "")
        .replace(/grid-row="[^"]*"/g, "")
        .replace(/grid-gutter="[^"]*"/g, "")
        .replace(/class="[^"]*"/g, "")
        .replace(/ target="[^"]*"/g, "")
        .replace(/<div[^>]*>/g, "")
        .replace(/<\/div>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&copy;/g, "©")
        .replace(/&reg;/g, "®")
        .replace(/&euro;/g, "€")
        .replace(/&pound;/g, "£")
        .replace(/&yen;/g, "¥")
        .replace(/&cent;/g, "¢")
        .replace(/<h2>/g, "## ")
        .replace(/<\/h2>/g, "\n")
        .replace(/<p>/g, "")
        .replace(/<\/p>/g, "\n")
        .replace(/<a href="([^"]*)">/g, "[$1](")
        .replace(/<\/a>/g, ")")
        .replace(/<strong>/g, "**")
        .replace(/<\/strong>/g, "**")
        .replace(/<em>/g, "*")
        .replace(/<\/em>/g, "*")
        .replace(/<br\s*\/?>/gi, "\n");

      const liveLinks = (liveInfo.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).map(
        (link) => {
          const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
          return { text: match[2].trim(), url: match[1] };
        },
      );

      var mergedLiveLinks = {};
      liveLinks.forEach((link) => {
        if (mergedLiveLinks[link.url]) {
          mergedLiveLinks[link.url].text += `, ${link.text}`;
        } else {
          mergedLiveLinks[link.url] = { text: link.text, url: link.url };
        }
      });
      liveResult = Object.values(mergedLiveLinks)
        .map((link) => ({
          location: link.text.split(",")[0]
            ? link.text.split(",")[0].trim()
            : "",
          date: link.text.split(",")[1] ? link.text.split(",")[1].trim() : "",
          name: link.text.split(",")[2] ? link.text.split(",")[2].trim() : "",
          url: link.url,
        }))
        .map((item) => {
          if (item.date && item.date.length === 6) {
            const year = "20" + item.date.slice(0, 2);
            const month = item.date.slice(2, 4);
            const day = item.date.slice(4, 6);
            item.date = `${year}-${month}-${day}`;
          }
          return item;
        });
    }

    if (djData) {
      const djInfo = djData
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/\\\//g, "/")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/grid-col="[^"]*"/g, "")
        .replace(/grid-pad="[^"]*"/g, "")
        .replace(/grid-row="[^"]*"/g, "")
        .replace(/grid-gutter="[^"]*"/g, "")
        .replace(/class="[^"]*"/g, "")
        .replace(/ target="[^"]*"/g, "")
        .replace(/<div[^>]*>/g, "")
        .replace(/<\/div>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&copy;/g, "©")
        .replace(/&reg;/g, "®")
        .replace(/&euro;/g, "€")
        .replace(/&pound;/g, "£")
        .replace(/&yen;/g, "¥")
        .replace(/&cent;/g, "¢")
        .replace(/<h2>/g, "## ")
        .replace(/<\/h2>/g, "\n")
        .replace(/<p>/g, "")
        .replace(/<\/p>/g, "\n")
        .replace(/<a href="([^"]*)">/g, "[$1](")
        .replace(/<\/a>/g, ")")
        .replace(/<strong>/g, "**")
        .replace(/<\/strong>/g, "**")
        .replace(/<em>/g, "*")
        .replace(/<\/em>/g, "*")
        .replace(/<br\s*\/?>/gi, "\n");

      const djLinks = (djInfo.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).map(
        (link) => {
          const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
          return { text: match[2].trim(), url: match[1] };
        },
      );

      console.log(djLinks);

      var mergedDjLinks = {};
      djLinks.forEach((link) => {
        if (mergedDjLinks[link.url]) {
          mergedDjLinks[link.url].text += `;,;, ${link.text}`;
        } else {
          mergedDjLinks[link.url] = { text: link.text, url: link.url };
        }
      });

      djResult = Object.values(mergedDjLinks)
        .map((link) => ({
          location: link.text.split(";,;,")[0]
            ? link.text.split(";,;,")[0].trim()
            : "",
          date: link.text.split(";,;,")[1]
            ? link.text.split(";,;,")[1].trim()
            : "",
          name: link.text.split(";,;,")[2]
            ? link.text.split(";,;,")[2].trim()
            : "",
          url: link.url,
        }))
        .map((item) => {
          if (item.date && item.date.length === 6) {
            const year = "20" + item.date.slice(0, 2);
            const month = item.date.slice(2, 4);
            const day = item.date.slice(4, 6);
            item.date = `${year}-${month}-${day}`;
          }
          return item;
        });
    }

    fs.writeFileSync('./data/djResult.json', JSON.stringify(djResult, null, 2));
    fs.writeFileSync('./data/liveResult.json', JSON.stringify(liveResult, null, 2));
    
    return [djResult, liveResult];
  } catch (error) {
    console.error("Error in getLiveDJSections:", error);
  }
}
getLiveDJSections()
  .then((data) => {
    // Compare the old and new data
    const oldDjResult = JSON.parse(fs.readFileSync('./data/djResultOld.json', 'utf8'));
    const oldLiveResult = JSON.parse(fs.readFileSync('./data/liveResultOld.json', 'utf8'));

    const djUpdatesAndAdditions = data[0].map(item => {
      const oldItem = oldDjResult.find(old => old.url === item.url);
      if (!oldItem) return { ...item, status: 'new' };
      if (oldItem.date !== item.date || oldItem.location !== item.location || oldItem.name !== item.name) {
        return { ...item, status: 'updated', oldData: oldItem };
      }
      return null;
    }).filter(Boolean);
    const djRemovals = oldDjResult
      .filter(oldItem => !data[0].some(item => item.url === oldItem.url))
      .map(item => ({ ...item, status: 'removed' }));
    const allDjChanges = [...djUpdatesAndAdditions, ...djRemovals];

    const liveUpdatesAndAdditions = data[1].map(item => {
      const oldItem = oldLiveResult.find(old => old.url === item.url);
      if (!oldItem) return { ...item, status: 'new' };
      if (oldItem.date !== item.date || oldItem.location !== item.location || oldItem.name !== item.name) {
        return { ...item, status: 'updated', oldData: oldItem };
      }
      return null;
    }).filter(Boolean);
    const liveRemovals = oldLiveResult
      .filter(oldItem => !data[1].some(item => item.url === oldItem.url))
      .map(item => ({ ...item, status: 'removed' }));
    const allLiveChanges = [...liveUpdatesAndAdditions, ...liveRemovals];

    if (allDjChanges.length > 0) {
      fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'DJ Performance Changes',
          embeds: allDjChanges.map((item) => {
            let color;
            let fields = [];
            let title = item.name;

            if (item.status === 'new') {
              color = 5763719; // Green
              fields.push({ name: 'Location', value: item.location, inline: true });
              fields.push({ name: 'Date', value: item.date, inline: true });
            } else if (item.status === 'updated') {
              color = 16705372; // Yellow
              if(item.oldData.name !== item.name) title = `${item.oldData.name} -> ${item.name}`;
              fields.push({ name: 'Location', value: item.oldData.location === item.location ? item.location : `${item.oldData.location} -> ${item.location}`, inline: true});
              fields.push({ name: 'Date', value: item.oldData.date === item.date ? item.date : `${item.oldData.date} -> ${item.date}`, inline: true});
            } else { // removed
              color = 15548997; // Red
              fields.push({ name: 'Location', value: item.location, inline: true });
              fields.push({ name: 'Date', value: item.date, inline: true });
            }
            
            return {
              title: title,
              description: `Status: ${item.status}`,
              url: item.url,
              color: color,
              fields: fields,
            };
          }),
        }),
      });
    }

    if (allLiveChanges.length > 0) {
      DISCORD_WEBHOOK_URLS.forEach((DISCORD_WEBHOOK_URL) => {
        fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Live Performance Changes',
            embeds: allLiveChanges.map((item) => {
              let color;
              let fields = [];
              let title = item.name;

              if (item.status === 'new') {
                color = 5763719; // Green
                fields.push({ name: 'Location', value: item.location, inline: true });
                fields.push({ name: 'Date', value: item.date, inline: true });
              } else if (item.status === 'updated') {
                color = 16705372; // Yellow
                if(item.oldData.name !== item.name) title = `${item.oldData.name} -> ${item.name}`;
                fields.push({ name: 'Location', value: item.oldData.location === item.location ? item.location : `${item.oldData.location} -> ${item.location}`, inline: true});
                fields.push({ name: 'Date', value: item.oldData.date === item.date ? item.date : `${item.oldData.date} -> ${item.date}`, inline: true});
              } else { // removed
                color = 15548997; // Red
                fields.push({ name: 'Location', value: item.location, inline: true });
                fields.push({ name: 'Date', value: item.date, inline: true });
              }
              
              return {
                title: title,
                description: `Status: ${item.status}`,
                url: item.url,
                color: color,
                fields: fields,
              };
            }),
          }),
        });
      });
    }
  })
  .catch((error) => {
    console.error("Error while getting live/DJ sections:", error);
  });
