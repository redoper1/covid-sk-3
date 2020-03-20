const Apify = require('apify');
const cheerio = require("cheerio");

const toNumber = (str) => {
    return parseInt(str.replace(",", ""))
};

const LATEST = "LATEST";

Apify.main(async () => {
    const url = "https://www.arcgis.com/apps/opsdashboard/index.html#/5fe83e34abc14349b7d2fcd5c48c6c85";
    const kvStore = await Apify.openKeyValueStore("COVID-19-SLOVAK-3");
    const dataset = await Apify.openDataset("COVID-19-SLOVAK-3-HISTORY");

    console.log('Launching Puppeteer...');
    const browser = await Apify.launchPuppeteer({
        headless: true,
        defaultViewport: {height: 1080, width: 1920},
        useChrome: true,
        useApifyProxy: false
    });

    console.log(`Getting data from ${url}...`);
    const page = await browser.newPage();
    await Apify.utils.puppeteer.injectJQuery(page);
    await page.goto(url, {waitUntil: "networkidle0", timeout: 60000});

    await page.waitFor(() => $("kpimetric:contains(Stav k)"));
    page.on("console", (log) => console.log(log.text()));
    await Apify.utils.sleep(10000);
    const extractedData = await page.evaluate(() => {
        const elementContains = (selector, pattern) => {
            const node = document.querySelectorAll(selector);
            if (node.length == 1) {
                if (node[0].textContent.includes(pattern)) {        
                    return node[0];
                }
            } else if (node.length > 1) {
                let rightNode = {};
                node.forEach(function(value, index) {
                    if (value.textContent.includes(pattern)) {
                        rightNode = value;
                    }
                });
                return rightNode;
            }
        }

        const totalInfected = elementContains('.dock-element .caption span', 'Celkovo potvrdení').closest('.dock-element').querySelector('.responsive-text-label text').textContent.replace(',', '');
        const totalNegative = elementContains('.dock-element .caption span', 'Celkovo negatívne testy').closest('.dock-element').querySelector('.responsive-text-label text').textContent.replace(',', '');

        /* Get data from graphs */
        let dataByDates = {};

        // Graph of infected
        let graphInfectedNodes = new Array();
        let graphInfectedNodes2 = new Array();
        function getGraphInfected() {
            const graphLines = elementContains('.chart-widget .widget-header', 'Potvrdené prípady').closest('.chart-widget').querySelectorAll('.amcharts-graph-line');
            graphLines.forEach(function(value, index) {
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Celkovo')) {
                    graphInfectedNodes = value.querySelectorAll('circle');
                }
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Denný prírastok') || value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Denný prirastok')) {
                    graphInfectedNodes2 = value.querySelectorAll('circle');
                }
            });
        }
        getGraphInfected();
        graphInfectedNodes.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Celkovo', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Celkovo', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const infectedCount = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            if (!dataByDates[date]) {
                dataByDates[date] = {};
            }
            dataByDates[date]['infectedTotal'] = infectedCount;
        });
        graphInfectedNodes2.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Denný prirastok', '').replace('Denný prírastok', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Denný prirastok', '').replace('Denný prírastok', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const infectedCount = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            if (!dataByDates[date]) {
                dataByDates[date] = {};
            }
            dataByDates[date]['infectedNew'] = infectedCount;
        });

        // Graph of negative
        let graphNegativeNodes = new Array();
        let graphNegativeNodes2 = new Array();
        function getGraphNegative() {
            const graphLines = elementContains('.chart-widget .widget-header', 'Negatívne testy').closest('.chart-widget').querySelectorAll('.amcharts-graph-line');
            graphLines.forEach(function(value, index) {
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Celkovo')) {
                    graphNegativeNodes = value.querySelectorAll('circle');
                }
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Denný prírastok') || value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Denný prirastok')) {
                    graphNegativeNodes2 = value.querySelectorAll('circle');
                }
            });
        }
        getGraphNegative();
        graphNegativeNodes.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Celkovo', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Celkovo', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const negativeCount = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            if (!dataByDates[date]) {
                dataByDates[date] = {};
            }
            dataByDates[date]['negativeTotal'] = negativeCount;
        });
        graphNegativeNodes2.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Denný prirastok', '').replace('Denný prírastok', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Denný prirastok', '').replace('Denný prírastok', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const negativeCount = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            if (!dataByDates[date]) {
                dataByDates[date] = {};
            }
            dataByDates[date]['negativeNew'] = negativeCount;
        });
        /* Get data from graphs end */

        /* Get data by regions */
        let dataByRegions = {};

        // Get data by county
        if (!dataByRegions['county']) {
            dataByRegions['county'] = {};
        }

        let regionsNodes = new Array();
        function getRegionsFromTable() {
            const regionsItems = elementContains('.list-widget .widget-header', 'Stav podľa okresov').closest('.list-widget').querySelectorAll('.feature-list-item');
            regionsItems.forEach(function(value, index) {
                if (value.querySelector('.external-html span')) {
                    regionsNodes.push(value.querySelector('.external-html span'));
                }
            });
        }
        getRegionsFromTable();
        regionsNodes.forEach(function(value, index) {
            const regionData = value.innerHTML;
            const region = regionData.replace(/(?:&nbsp;)+<.*/g, '').replace('Okresy ', '').trim();
            const infected = regionData.replace(/.*(?:e60000">)/g, '').replace(/(?:&nbsp;)<\/.*/g, '').trim();
            const infectedNew = regionData.replace(/.*(?:00a9e6">&nbsp;)/g, '').replace(/<\/span><\/s.*/g, '').trim();
            dataByRegions['county'][region] = {};
            dataByRegions['county'][region]['infected'] = infected;
            dataByRegions['county'][region]['infectedNew'] = infectedNew;
        });

        /* Get data by regions end */

        const lastUpdated = elementContains('.external-html h3 span span', 'Stav k').textContent.replace('Stav k', '').trim().replace(/\. /g, '.');

        return {
            lastUpdated: lastUpdated,
            totalInfected: totalInfected,
            totalNegative: totalNegative,
            dataByDates: dataByDates,
            dataByRegions: dataByRegions
        }
    });

    const lastUpdated = extractedData.lastUpdated;
    const parts = lastUpdated.split(" ");
    const splited = parts[0].split(".");
    let lastUpdatedParsed = new Date(`${splited[1]}.${splited[0]}.${splited[2]} ${parts[1]}`);
    lastUpdatedParsed = new Date(Date.UTC(lastUpdatedParsed.getFullYear(), lastUpdatedParsed.getMonth(), lastUpdatedParsed.getDate(), lastUpdatedParsed.getHours() - 1, lastUpdatedParsed.getMinutes()));

    console.log(`Processing and saving data.`);

    const now = new Date();

    const data = {
        dataByDates: extractedData.dataByDates,
        dataByRegions: extractedData.dataByRegions,
        totalInfected: extractedData.totalInfected,
        totalNegative: extractedData.totalNegative,
        sourceUrl: url,
        lastUpdatedAtSource: lastUpdatedParsed.toISOString(),
        lastUpdatedAtApify: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes())).toISOString(),
        readMe: "https://apify.com/davidrychly/covid-sk-3",
    };

    // Compare and save to history
    const latest = await kvStore.getValue(LATEST);
    if (latest && latest.lastUpdatedAtApify) {
        delete latest.lastUpdatedAtApify;
    }
    const actual = Object.assign({}, data);
    delete actual.lastUpdatedAtApify;

    if (JSON.stringify(latest) !== JSON.stringify(actual)) {
        await dataset.pushData(data);
    }

    await kvStore.setValue(LATEST, data);
    await Apify.pushData(data);

    console.log('Done.');
});