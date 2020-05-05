const Apify = require('apify');
//const { elementContains, getDockElementNumber } = require('./utils/helpers');
const constants = require('./constants/index');

Apify.main(async () => {
    const url0 = "https://www.arcgis.com/apps/opsdashboard/index.html#/5fe83e34abc14349b7d2fcd5c48c6c85";
    let url = url0;
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
    await page.goto(url, {waitUntil: "networkidle0", timeout: 60000});

    if (await page.$x("//*[contains(.,'Prejdite na novú verziu')]") !== null) {
        const hrefs = await page.evaluate(() => Array.from(
                document.querySelectorAll('a[href]'),
                a => a.getAttribute('href')
        ));
        
        url = hrefs[0];
    }

    if (url != url0) {
        console.log(`Getting data from ${url}...`);
        await page.goto(url, {waitUntil: "networkidle0", timeout: 60000});
    }

    if (await page.$x("//div[contains(concat(' ',normalize-space(@class),' '),'widget-embed')]/iframe") !== null) {
        url = await page.evaluate(() => {
            return document.querySelector('.widget-embed iframe').getAttribute('src');
        });
    }

    if (url != url0) {
        console.log(`Getting data from ${url}...`);
        await page.goto(url, {waitUntil: "networkidle0", timeout: 60000});
    }

    /*page.exposeFunction("elementContains", elementContains);
    page.exposeFunction("getDockElementNumber", getDockElementNumber);*/
    await Apify.utils.puppeteer.injectJQuery(page);
    page.on("console", (log) => console.log(log.text()));

    console.log('Starting scraping...');

    /* Get basic initially displayed data */
    let basicData = await page.evaluate((constants) => {
        const elementContains = (selector, pattern) => {
            const node = document.querySelectorAll(selector);
            if (node.length == 1) {
                if (node[0].textContent.includes(pattern)) {
                    return node[0];
                }
            } else if (node.length > 1) {
                let rightNode = null;
                node.forEach(function(value, index) {
                    if (value.textContent.includes(pattern)) {
                        rightNode = value;
                    }
                });
                return rightNode;
            }
        }
        
        function getDockElementNumber(node) {
            return node !== null ? node.closest('.dock-element').querySelector('.responsive-text-label text').textContent.replace(',', '') : null;
        }

        console.log('Scraping basic data...');

        let totalInfected = getDockElementNumber(elementContains('.dock-element .caption span', 'Pozitívne testovaní celkovo'));
        let totalNegative = getDockElementNumber(elementContains('.dock-element .caption span', 'Celkovo negatívne testy'));
        let totalTested = null;
        let totalDeaths = getDockElementNumber(elementContains('.dock-element .caption span', 'Úmrtia celkovo'));
        let totalCured = getDockElementNumber(elementContains('.dock-element .caption span', 'Uzdravení celkovo'));
        let infectedCurrently = null;
        let infectedNewToday = getDockElementNumber(elementContains('.dock-element .caption span', 'Noví pozitívni'));

        const now = new Date();
        let lastUpdated = now.getDate() + "." + now.getMonth() + "." + now.getFullYear();
        if (elementContains('.external-html h3 span', 'Stav k') !== null) {
            const lastUpdatedEl = elementContains('.external-html h3 span', 'Stav k');
            lastUpdated = lastUpdatedEl.textContent.replace('Stav k', '').trim().replace(/\. /g, '.');
        }

        return {
            lastUpdated: lastUpdated,
            totalInfected: totalInfected,
            infectedNewToday: infectedNewToday,
            infectedCurrently: infectedCurrently,
            totalNegative: totalNegative,
            totalTested: totalTested,
            totalDeaths: totalDeaths,
            totalCured: totalCured,
        }
    }, constants);

    /* Get data by regions */
    const dataByRegions = await page.evaluate((constants) => {
        const elementContains = (selector, pattern) => {
            const node = document.querySelectorAll(selector);
            if (node.length == 1) {
                if (node[0].textContent.includes(pattern)) {
                    return node[0];
                }
            } else if (node.length > 1) {
                let rightNode = null;
                node.forEach(function(value, index) {
                    if (value.textContent.includes(pattern)) {
                        rightNode = value;
                    }
                });
                return rightNode;
            }
        }

        console.log('Scraping data by regions...');

        let dataByRegions = {};

        // Get data by county
        if (!dataByRegions['county']) {
            dataByRegions['county'] = new Array;
        }

        let regionsNodes = new Array();
        function getRegionsFromTable() {
            let regionsItems = new Array();
            if (elementContains('.list-widget .widget-header', 'Okresy') !== null) {
                let regionsHeading = elementContains('.list-widget .widget-header', 'Okresy');
                regionsItems = regionsHeading.closest('.list-widget').querySelectorAll('.feature-list-item');
            }
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
            const infected = regionData.replace(/.*(?:e60000.*">)/g, '').replace(/(?:&nbsp;)<\/.*/g, '').trim();
            const infectedNew = regionData.replace(/.*(?:00a9e6.*">&nbsp;)/g, '').replace(/<\/span><.*/g, '').trim();
            dataByRegions['county'].push({
                'name': region,
                'infected': parseInt(infected),
                'infectedNew': parseInt(infectedNew)
            });
        });

        // Get data by region
        if (!dataByRegions['region']) {
            dataByRegions['region'] = new Array();
        }

        let regionsData = {};

        regionsNodes.forEach(function(value, index) {
            const regionData = value.innerHTML;
            const region = regionData.replace(/(?:&nbsp;)+<.*/g, '').replace('Okresy ', '').trim();
            const infected = regionData.replace(/.*(?:e60000.*">)/g, '').replace(/(?:&nbsp;)<\/.*/g, '').trim();
            const infectedNew = regionData.replace(/.*(?:00a9e6.*">&nbsp;)/g, '').replace(/<\/span><.*/g, '').trim();

            let resRegion = '???';

            for (const [key, value] of Object.entries(constants.regionsByCounty)) {
                if (value.includes(region)) {
                    resRegion = key;
                }
            };

            if (resRegion == '???') {
                console.error('error region: ' + region);
            }

            if (!regionsData[resRegion]) {
                regionsData[resRegion] = {};
            }

            if (!regionsData[resRegion]['infected']) {
                regionsData[resRegion]['infected'] = parseInt(infected);
            } else {
                regionsData[resRegion]['infected'] = regionsData[resRegion]['infected'] + parseInt(infected);
            }

            if (!regionsData[resRegion]['infectedNew']) {
                regionsData[resRegion]['infectedNew'] = parseInt(infectedNew);
            } else {
                regionsData[resRegion]['infectedNew'] = regionsData[resRegion]['infectedNew'] + parseInt(infectedNew);
            }
        });

        Object.entries(regionsData).forEach(function(value, index) {
            dataByRegions['region'].push({
                'name': value[0],
                'infected': parseInt(value[1]['infected']),
                'infectedNew': parseInt(value[1]['infectedNew'])
            });
        });

        return dataByRegions;
    }, constants);

    /* Get data by dates */
    // Define empty objects for data by dates
    let dataByDatesTemp = new Array();
    let dataByDates = new Array();

    // Get data from development graph
    const developmentGraphData = await page.evaluate((constants) => {
        const elementContains = (selector, pattern) => {
            const node = document.querySelectorAll(selector);
            if (node.length == 1) {
                if (node[0].textContent.includes(pattern)) {
                    return node[0];
                }
            } else if (node.length > 1) {
                let rightNode = null;
                node.forEach(function(value, index) {
                    if (value.textContent.includes(pattern)) {
                        rightNode = value;
                    }
                });
                return rightNode;
            }
        }

        console.log('Scraping data from development graph...');

        let graphDevelopmentNodes = new Array();
        let graphDevelopmentNodes2 = new Array();
        let graphDevelopmentNodes3 = new Array();
        let graphDevelopmentNodes4 = new Array();
        let infectedCurrently = null;
        let dataByDatesTemp = new Array();

        function getGraphDevelopment() {
            const graphLines = elementContains('.chart-widget .widget-header', 'Priebeh po dňoch') !== null ? elementContains('.chart-widget .widget-header', 'Priebeh po dňoch').closest('.chart-widget').querySelectorAll('.amcharts-graph-line') : null;
            graphLines.forEach(function(value, index) {
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Pozitívne testovaní celkovo')) {
                    graphDevelopmentNodes = value.querySelectorAll('circle');
                }
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Aktívni pozitívni')) {
                    graphDevelopmentNodes2 = value.querySelectorAll('circle');
                }
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label').startsWith('Uzdravení')) {
                    graphDevelopmentNodes3 = value.querySelectorAll('circle');
                }
            });

            const graphColumns = elementContains('.chart-widget .widget-header', 'Priebeh po dňoch') !== null ? elementContains('.chart-widget .widget-header', 'Priebeh po dňoch').closest('.chart-widget').querySelectorAll('.amcharts-graph-column') : null;
            graphColumns.forEach(function(value, index) {
                if (value.querySelector('g.amcharts-graph-column') && value.querySelector('g.amcharts-graph-column').getAttribute('aria-label') && value.querySelector('g.amcharts-graph-column').getAttribute('aria-label').startsWith('Mŕtvi')) {
                    graphDevelopmentNodes4 = value.querySelectorAll('g.amcharts-graph-column');
                }
            });
        }
        getGraphDevelopment();
        graphDevelopmentNodes.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Pozitívne testovaní celkovo', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Pozitívne testovaní celkovo', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const infectedCount = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            let exist = dataByDatesTemp.findIndex((object) => object.date === date);
            if (exist >= 0) {
                dataByDatesTemp[exist]['date'] = date;
                dataByDatesTemp[exist]['infectedTotal'] = parseInt(infectedCount);
            } else {
                dataByDatesTemp.push({ date: date, infectedTotal: parseInt(infectedCount)});
            }
        });
        graphDevelopmentNodes2.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Aktívni pozitívni', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Aktívni pozitívni', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const infectedCurrentlyCount = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            let exist = dataByDatesTemp.findIndex((object) => object.date === date);
            if (exist >= 0) {
                dataByDatesTemp[exist]['date'] = date;
                dataByDatesTemp[exist]['infectedCurrently'] = parseInt(infectedCurrentlyCount);
            } else {
                dataByDatesTemp.push({ date: date, infectedCurrently: parseInt(infectedCurrentlyCount)});
            }
            if (index == graphDevelopmentNodes2.length - 1) {
                infectedCurrently = parseInt(infectedCurrentlyCount);
            }
        });
        graphDevelopmentNodes3.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Uzdravení', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Uzdravení', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const recovered = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            let exist = dataByDatesTemp.findIndex((object) => object.date === date);
            if (exist >= 0) {
                dataByDatesTemp[exist]['date'] = date;
                dataByDatesTemp[exist]['recovered'] = parseInt(recovered);
            } else {
                dataByDatesTemp.push({ date: date, recovered: parseInt(recovered)});
            }
        });
        graphDevelopmentNodes4.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Mŕtvi', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Mŕtvi', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const deceased = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            let exist = dataByDatesTemp.findIndex((object) => object.date === date);
            if (exist >= 0) {
                dataByDatesTemp[exist]['date'] = date;
                dataByDatesTemp[exist]['deceased'] = parseInt(deceased);
            } else {
                dataByDatesTemp.push({ date: date, deceased: parseInt(deceased)});
            }
        });

        return {dataByDatesTemp, infectedCurrently};
    }, constants);

    // Get data from tests graph
    console.log('Switching to tests graph...');
    await page.waitForXPath("//div[contains(concat(' ',normalize-space(@class),' '),'tab-title')][contains(.,'Priebeh testovania')]");
    await page.evaluate(() => {
        const xpath = "//div[contains(concat(' ',normalize-space(@class),' '),'tab-title')][contains(.,'Priebeh testovania')]";
        const result = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null);

        result.iterateNext().click();
    });
    
    await page.waitFor(500);

    const testsGraphData = await page.evaluate((constants) => {
        const elementContains = (selector, pattern) => {
            const node = document.querySelectorAll(selector);
            if (node.length == 1) {
                if (node[0].textContent.includes(pattern)) {
                    return node[0];
                }
            } else if (node.length > 1) {
                let rightNode = null;
                node.forEach(function(value, index) {
                    if (value.textContent.includes(pattern)) {
                        rightNode = value;
                    }
                });
                return rightNode;
            }
        }

        console.log('Scraping data from tests graph...');

        let graphTestsNodes = new Array();
        let graphTestsNodes2 = new Array();
        let totalTested = null;
        let dataByDatesTemp = new Array();

        function getGraphTests() {
            const graphLines = elementContains('.chart-widget .widget-header', 'Priebeh testovania') !== null ? elementContains('.chart-widget .widget-header', 'Priebeh testovania').closest('.chart-widget').querySelectorAll('.amcharts-graph-line') : null;
            graphLines.forEach(function(value, index) {
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label') && value.querySelector('circle').getAttribute('aria-label').startsWith('Celkový počet testov')) {
                    graphTestsNodes = value.querySelectorAll('circle');
                }
                if (value.querySelector('circle') && value.querySelector('circle').getAttribute('aria-label') && value.querySelector('circle').getAttribute('aria-label').startsWith('Denný prírastok testov')) {
                    graphTestsNodes2 = value.querySelectorAll('circle');
                }
            });
        }
        getGraphTests();
        graphTestsNodes.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Celkový počet testov', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Celkový počet testov', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const testedTotal = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();
            
            let exist = dataByDatesTemp.findIndex((object) => object.date === date);
            if (exist >= 0) {
                dataByDatesTemp[exist]['date'] = date;
                dataByDatesTemp[exist]['testedTotal'] = parseInt(testedTotal);
            } else {
                dataByDatesTemp.push({ date: date, testedTotal: parseInt(testedTotal)});
            }
            if (index == graphTestsNodes.length - 1) {
                totalTested = parseInt(testedTotal);
            }
        });
        graphTestsNodes2.forEach(function(value, index) {
            const data = value.getAttribute('aria-label');
            let date = data.replace('Denný prírastok testov', '').replace(/(, \d\d\d\d).*/g, '$1').trim() ? data.replace('Denný prírastok testov', '').replace(/(, \d\d\d\d).*/g, '$1').trim() : 0;
            const testedNew = data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') ? data.replace(/.*, \d\d\d\d (.*)/g, '$1').trim().replace(',', '') : 0;

            date = new Date(Date.parse(date.replace(',', ''))).toISOString();

            let exist = dataByDatesTemp.findIndex((object) => object.date === date);
            if (exist >= 0) {
                dataByDatesTemp[exist]['date'] = date;
                dataByDatesTemp[exist]['testedNew'] = parseInt(testedNew);
            } else {
                dataByDatesTemp.push({ date: date, testedNew: parseInt(testedNew)});
            }
        });

        return {dataByDatesTemp, totalTested};
    }, constants);

    dataByDatesTemp = developmentGraphData.dataByDatesTemp.map((item, i) => {
        if (item.date === testsGraphData.dataByDatesTemp[i].date) {
            return Object.assign({}, item, testsGraphData.dataByDatesTemp[i])
        }
    });

    // Process data for each date
    Object.entries(dataByDatesTemp).forEach(function(value, index) {
        if (index > 0) {
            dataByDates.push({
                "date": value[1]['date'],
                "infected": parseInt(value[1]['infectedTotal']),
                "infectedNew": parseInt(value[1]['infectedTotal']) - parseInt(dataByDates[index - 1]['infected']),
                "negative": parseInt(value[1]['testedTotal']) - parseInt(value[1]['infectedTotal']),
                "negativeNew": parseInt(value[1]['testedNew']) - (parseInt(value[1]['infectedTotal']) - parseInt(dataByDates[index - 1]['infected'])),
                "tested": parseInt(value[1]['testedTotal']),
                "testedNew": parseInt(value[1]['testedNew']),
                "recovered": parseInt(value[1]['recovered']),
                "deceased": parseInt(value[1]['deceased']),
                "infectedCurrently": parseInt(value[1]['infectedCurrently'])
            });
        } else {
            dataByDates.push({
                "date": value[1]['date'],
                "infected": parseInt(value[1]['infectedTotal']),
                "infectedNew": 0,
                "negative": parseInt(value[1]['testedTotal']) - parseInt(value[1]['infectedTotal']),
                "negativeNew": parseInt(value[1]['testedNew']) - parseInt(value[1]['infectedTotal']),
                "tested": parseInt(value[1]['testedTotal']),
                "testedNew": parseInt(value[1]['testedNew']),
                "recovered": parseInt(value[1]['recovered']),
                "deceased": parseInt(value[1]['deceased']),
                "infectedCurrently": parseInt(value[1]['infectedCurrently'])
            });
        }
    });

    console.log(`Processing and saving data.`);

    const lastUpdated = basicData.lastUpdated;
    const parts = lastUpdated.split(" ");
    const splited = parts[0].split(".");
    let lastUpdatedParsed = new Date();
    if (parts.length > 1) {
        lastUpdatedParsed = new Date(`${splited[1]}.${splited[0]}.${splited[2]} ${parts[1]}`);
    } else if (parts.length == 1) {
        lastUpdatedParsed = new Date(`${splited[1]}.${splited[0]}.${splited[2]}`);
    }
    lastUpdatedParsed = new Date(Date.UTC(lastUpdatedParsed.getFullYear(), lastUpdatedParsed.getMonth(), lastUpdatedParsed.getDate(), lastUpdatedParsed.getHours() - 1, lastUpdatedParsed.getMinutes()));

    const now = new Date();

    const data = {
        dataByDates: dataByDates,
        dataByRegions: dataByRegions,
        infected: parseInt(basicData.totalInfected),
        infectedNewToday : parseInt(basicData.infectedNewToday),
        infectedCurrently: parseInt(developmentGraphData.infectedCurrently),
        negative: parseInt(testsGraphData.totalTested) - parseInt(basicData.totalInfected),
        tested: parseInt(testsGraphData.totalTested),
        recovered: parseInt(basicData.totalCured),
        deceased: parseInt(basicData.totalDeaths),
        country: "Slovakia",
        historyData: "https://api.apify.com/v2/datasets/oUWi8ci7F2R9V5ZFy/items?format=json&clean=1",
        sourceUrl: url,
        lastUpdatedAtSource: lastUpdatedParsed.toISOString(),
        lastUpdatedAtApify: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes())).toISOString(),
        readMe: "https://apify.com/davidrychly/covid-sk-3",
    };

    // Compare and save to history
    const latest = await kvStore.getValue(constants.LATEST);
    if (latest && latest.lastUpdatedAtApify) {
        delete latest.lastUpdatedAtApify;
    }
    const actual = Object.assign({}, data);
    delete actual.lastUpdatedAtApify;

    if (JSON.stringify(latest) !== JSON.stringify(actual)) {
        await dataset.pushData(data);
    }

    await kvStore.setValue(constants.LATEST, data);
    await Apify.pushData(data);

    console.log('Done.');
});