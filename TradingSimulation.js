﻿function newAAMastersPlottersTradingSimulationTradingSimulation ()
{

    const MODULE_NAME = "Simulation Plotter";
    const INFO_LOG = false;
    const ERROR_LOG = true;
    const INTENSIVE_LOG = false;
    const logger = newWebDebugLog();
    logger.fileName = MODULE_NAME;

    let thisObject = {

        // Main functions and properties.

        initialize: initialize,
        container: undefined,
        getContainer: getContainer,
        setTimePeriod: setTimePeriod,
        setDatetime: setDatetime,
        draw: draw,
        recalculateScale: recalculateScale, 

        /* Events declared outside the plotter. */

        onDailyFileLoaded: onDailyFileLoaded, 

        // Secondary functions and properties.

        currentRecord: undefined
    };

    /* this is part of the module template */

    let container = newContainer();     // Do not touch this 3 lines, they are just needed.
    container.initialize();
    thisObject.container = container;

    let timeLineCoordinateSystem = newTimeLineCoordinateSystem();       // Needed to be able to plot on the timeline, otherwise not.

    let timePeriod;                     // This will hold the current Time Period the user is at.
    let datetime;                       // This will hold the current Datetime the user is at.

    let marketFile;                     // This is the current Market File being plotted.
    let fileCursor;                     // This is the current File Cursor being used to retrieve Daily Files.

    let marketFiles;                      // This object will provide the different Market Files at different Time Periods.
    let dailyFiles;                // This object will provide the different File Cursors at different Time Periods.

    /* these are module specific variables: */

    let records = [];                   // Here we keep the records to be ploted every time the Draw() function is called by the AAWebPlatform.

    return thisObject;

    function initialize(pStorage, pExchange, pMarket, pDatetime, pTimePeriod, callBackFunction) {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] initialize -> Entering function."); }

            /* Store the information received. */

            marketFiles = pStorage.marketFiles[0];
            dailyFiles = pStorage.dailyFiles[0];

            datetime = pDatetime;
            timePeriod = pTimePeriod;

            /* We need a Market File in order to calculate the Y scale, since this scale depends on actual data. */

            marketFile = marketFiles.getFile(ONE_DAY_IN_MILISECONDS);  // This file is the one processed faster. 

            recalculateScale();

            /* Now we set the right files according to current Period. */

            marketFile = marketFiles.getFile(pTimePeriod);
            fileCursor = dailyFiles.getFileCursor(pTimePeriod);

            /* Listen to the necesary events. */

            viewPort.eventHandler.listenToEvent("Zoom Changed", onZoomChanged);
            viewPort.eventHandler.listenToEvent("Offset Changed", onOffsetChanged);
            marketFiles.eventHandler.listenToEvent("Files Updated", onFilesUpdated);
            canvas.eventHandler.listenToEvent("Drag Finished", onDragFinished);

            /* Get ready for plotting. */

            recalculate();

            callBackFunction();

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] initialize -> err.message = " + err.message); }
        }
    }

    function getContainer(point) {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] getContainer -> Entering function."); }

            let container;

            /* First we check if this point is inside this space. */

            if (this.container.frame.isThisPointHere(point) === true) {

                return this.container;

            } else {

                /* This point does not belong to this space. */

                return undefined;
            }

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] getContainer -> err.message = " + err.message); }
        }
    }

    function onFilesUpdated() {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] onFilesUpdated -> Entering function."); }

            let newMarketFile = marketFiles.getFile(timePeriod);

            if (newMarketFile !== undefined) {

                marketFile = newMarketFile;
                recalculate();
            }

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] onFilesUpdated -> err.message = " + err.message); }
        }
    }

    function setTimePeriod(pTimePeriod) {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] setTimePeriod -> Entering function."); }

            if (timePeriod !== pTimePeriod) {

                timePeriod = pTimePeriod;

                if (timePeriod >= _1_HOUR_IN_MILISECONDS) {

                    let newMarketFile = marketFiles.getFile(pTimePeriod);

                    if (newMarketFile !== undefined) {

                        marketFile = newMarketFile;
                        recalculate();
                    }

                } else {

                    let newFileCursor = dailyFiles.getFileCursor(pTimePeriod);

                    if (newFileCursor !== undefined) {

                        fileCursor = newFileCursor;
                        recalculate();
                    }
                }
            }

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] setTimePeriod -> err.message = " + err.message); }
        }
    }

    function setDatetime(pDatetime) {

        if (INFO_LOG === true) { logger.write("[INFO] setDatetime -> Entering function."); }

        datetime = pDatetime;

    }

    function onDailyFileLoaded(event) {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] onDailyFileLoaded -> Entering function."); }

            if (event.currentValue === event.totalValue) {

                /* This happens only when all of the files in the cursor have been loaded. */

                recalculate();

            }

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] onDailyFileLoaded -> err.message = " + err.message); }
        }
    }

    function draw() {

        try {

            if (INTENSIVE_LOG === true) { logger.write("[INFO] draw -> Entering function."); }

            this.container.frame.draw();

            plotChart();

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] draw -> err.message = " + err.message); }
        }
    }

    function recalculate() {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] recalculate -> Entering function."); }

            if (timePeriod >= _1_HOUR_IN_MILISECONDS) {

                recalculateUsingMarketFiles();

            } else {

                recalculateUsingDailyFiles();

            }

            thisObject.container.eventHandler.raiseEvent("Records Changed", records);

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] recalculate -> err.message = " + err.message); }
        }
    }

    function recalculateUsingDailyFiles() {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] recalculateUsingDailyFiles -> Entering function."); }

            if (fileCursor === undefined) { return; } // We need to wait

            if (fileCursor.files.size === 0) { return; } // We need to wait until there are files in the cursor

            let daysOnSides = getSideDays(timePeriod);

            let leftDate = getDateFromPoint(viewPort.visibleArea.topLeft, thisObject.container, timeLineCoordinateSystem);
            let rightDate = getDateFromPoint(viewPort.visibleArea.topRight, thisObject.container, timeLineCoordinateSystem);

            let dateDiff = rightDate.valueOf() - leftDate.valueOf();

            let farLeftDate = new Date(leftDate.valueOf() - dateDiff * 1.5);
            let farRightDate = new Date(rightDate.valueOf() + dateDiff * 1.5);

            let currentDate = new Date(farLeftDate.valueOf());

            records = [];

            while (currentDate.valueOf() <= farRightDate.valueOf() + ONE_DAY_IN_MILISECONDS) {

                let stringDate = currentDate.getFullYear() + '-' + pad(currentDate.getMonth() + 1, 2) + '-' + pad(currentDate.getDate(), 2);

                let dailyFile = fileCursor.files.get(stringDate);

                if (dailyFile !== undefined) {

                    for (let i = 0; i < dailyFile.length; i++) {

                        let record = {
                            begin: undefined,
                            end: undefined,
                            type: undefined,
                            rate: undefined,
                            amount: undefined,
                            balanceA: undefined,
                            balanceB: undefined
                        };

                        record.begin = marketFile[i][0];
                        record.end = marketFile[i][1];
                        record.type = marketFile[i][2];
                        record.rate = marketFile[i][3];
                        record.amount = marketFile[i][4];
                        record.balanceA = marketFile[i][5];
                        record.balanceB = marketFile[i][6];

                        if (record.begin >= farLeftDate.valueOf() && record.end <= farRightDate.valueOf()) {

                            records.push(record);

                            if (datetime.valueOf() >= record.begin && datetime.valueOf() <= record.end) {

                                thisObject.currentRecord = record;
                                thisObject.container.eventHandler.raiseEvent("Current Record Changed", thisObject.currentRecord);

                            }
                        }
                    }
                }

                currentDate = new Date(currentDate.valueOf() + ONE_DAY_IN_MILISECONDS);
            }

            /* Lests check if all the visible screen is going to be covered by records. */

            let lowerEnd = leftDate.valueOf();
            let upperEnd = rightDate.valueOf();

            if (records.length > 0) {

                if (records[0].begin > lowerEnd || records[records.length - 1].end < upperEnd) {

                    setTimeout(recalculate, 2000);

                    //console.log("File missing while calculating records, scheduling a recalculation in 2 seconds.");

                }
            }

            //console.log("Olivia > recalculateUsingDailyFiles > total records generated : " + records.length);

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] recalculateUsingDailyFiles -> err.message = " + err.message); }
        }
    }

    function recalculateUsingMarketFiles() {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] recalculateUsingMarketFiles -> Entering function."); }

            if (marketFile === undefined) { return; } // Initialization not complete yet.

            let daysOnSides = getSideDays(timePeriod);

            let leftDate = getDateFromPoint(viewPort.visibleArea.topLeft, thisObject.container, timeLineCoordinateSystem);
            let rightDate = getDateFromPoint(viewPort.visibleArea.topRight, thisObject.container, timeLineCoordinateSystem);

            let dateDiff = rightDate.valueOf() - leftDate.valueOf();

            leftDate = new Date(leftDate.valueOf() - dateDiff * 1.5);
            rightDate = new Date(rightDate.valueOf() + dateDiff * 1.5);

            records = [];

            for (let i = 0; i < marketFile.length; i++) {

                let record = {
                    begin: undefined,
                    end: undefined,
                    type: undefined,
                    rate: undefined,
                    amount: undefined,
                    balanceA: undefined,
                    balanceB: undefined,
                    profit: undefined,
                    lastProfit: undefined,
                    stopLoss: undefined,
                    roundtrips: undefined,
                    hits: undefined,
                    fails: undefined,
                    hitRatio: undefined,
                    ROI: undefined,
                    periods: undefined,
                    days: undefined,
                    anualizedRateOfReturn: undefined,
                    sellRate: undefined,
                    lastProfitPercent: undefined
                };

                record.begin = marketFile[i][0];
                record.end = marketFile[i][1];
                record.type = marketFile[i][2];
                record.rate = marketFile[i][3];
                record.amount = marketFile[i][4];
                record.balanceA = marketFile[i][5];
                record.balanceB = marketFile[i][6];
                record.profit = marketFile[i][7];
                record.lastProfit = marketFile[i][8];
                record.stopLoss = marketFile[i][9];
                record.roundtrips = marketFile[i][10];
                record.hits = marketFile[i][11];
                record.fails = marketFile[i][12];
                record.hitRatio = marketFile[i][13];
                record.ROI = marketFile[i][14];
                record.periods = marketFile[i][15];
                record.days = marketFile[i][16];
                record.anualizedRateOfReturn = marketFile[i][17];
                record.sellRate = marketFile[i][18];
                record.lastProfitPercent = marketFile[i][19];

                if (record.begin >= leftDate.valueOf() && record.end <= rightDate.valueOf()) {

                    records.push(record);

                    if (datetime.valueOf() >= record.begin && datetime.valueOf() <= record.end) {

                        thisObject.currentRecord = record;
                        thisObject.container.eventHandler.raiseEvent("Current Record Changed", thisObject.currentRecord);

                    }
                }
            }

            //console.log("Olivia > recalculateUsingMarketFiles > total records generated : " + records.length);

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] recalculateUsingMarketFiles -> err.message = " + err.message); }
        }
    }

    function recalculateScale() {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] recalculateScale -> Entering function."); }

            if (marketFile === undefined) { return; } // We need the market file to be loaded to make the calculation.

            if (timeLineCoordinateSystem.maxValue > 0) { return; } // Already calculated.

            let minValue = {
                x: EARLIEST_DATE.valueOf(),
                y: 0
            };

            let maxValue = {
                x: MAX_PLOTABLE_DATE.valueOf(),
                y: nextPorwerOf10(getMaxRate()) / 4 // TODO: This 4 is temporary
            };


            timeLineCoordinateSystem.initialize(
                minValue,
                maxValue,
                thisObject.container.frame.width,
                thisObject.container.frame.height
            );

            function getMaxRate() {

                if (INFO_LOG === true) { logger.write("[INFO] recalculateScale -> getMaxRate -> Entering function."); }

                let maxValue = 0;

                for (let i = 0; i < marketFile.length; i++) {

                    let currentMax = 25000; // TODO Fix this, since when there are not records above 10k the scales is dissincronized with the scale of the candles.  marketFile[i][3];   // 3 = rate.

                    if (maxValue < currentMax) {
                        maxValue = currentMax;
                    }
                }

                return maxValue;

            }

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] recalculateScale -> err.message = " + err.message); }
        }
    }

    function plotChart() {

        try {

            if (INTENSIVE_LOG === true) { logger.write("[INFO] plotChart -> Entering function."); }

            let record;

            if (records.length > 0) {

                /* Now we calculate and plot the records */

                for (let i = 0; i < records.length; i++) {

                    record = records[i];

                    let direction = 0;

                    if (record.type === 'Buy') { direction = -1; }
                    if (record.type === 'Sell-1') { direction = +1; }
                    if (record.type === 'Sell-2') { direction = +1; }
                    if (record.type === 'Pre-Sell') { direction = +1; }

                    let recordPoint1 = {
                        x: record.begin + (record.end - record.begin) / 2,
                        y: record.rate
                    };

                    let recordPoint2 = {
                        x: record.begin + (record.end - record.begin) / 2,
                        y: record.rate + record.rate * 0.05 * direction
                    };

                    let recordPoint3 = {
                        x: record.begin + (record.end - record.begin) / 2,
                        y: record.rate + record.rate * 0.05 * direction
                    };

                    let recordPoint4 = {
                        x: record.begin,
                        y: record.stopLoss
                    };

                    let recordPoint5 = {
                        x: record.end,
                        y: record.stopLoss
                    };

                    if (record.stopLoss === 0) { // Put these points out of range if stopLoss is zero.

                        recordPoint4.x = 0;
                        recordPoint5.x = 0;

                    }

                    let recordPoint6 = {
                        x: record.begin,
                        y: record.sellRate
                    };

                    let recordPoint7 = {
                        x: record.end,
                        y: record.sellRate
                    };

                    if (record.sellRate === 0) { // Put these points out of range if sellRate is zero.

                        recordPoint6.x = 0;
                        recordPoint7.x = 0;

                    }

                    recordPoint1 = timeLineCoordinateSystem.transformThisPoint(recordPoint1);
                    recordPoint2 = timeLineCoordinateSystem.transformThisPoint(recordPoint2);
                    recordPoint3 = timeLineCoordinateSystem.transformThisPoint(recordPoint3);
                    recordPoint4 = timeLineCoordinateSystem.transformThisPoint(recordPoint4);
                    recordPoint5 = timeLineCoordinateSystem.transformThisPoint(recordPoint5);
                    recordPoint6 = timeLineCoordinateSystem.transformThisPoint(recordPoint6);
                    recordPoint7 = timeLineCoordinateSystem.transformThisPoint(recordPoint7);

                    recordPoint1 = transformThisPoint(recordPoint1, thisObject.container);
                    recordPoint2 = transformThisPoint(recordPoint2, thisObject.container);
                    recordPoint3 = transformThisPoint(recordPoint3, thisObject.container);
                    recordPoint4 = transformThisPoint(recordPoint4, thisObject.container);
                    recordPoint5 = transformThisPoint(recordPoint5, thisObject.container);
                    recordPoint6 = transformThisPoint(recordPoint6, thisObject.container);
                    recordPoint7 = transformThisPoint(recordPoint7, thisObject.container);

                    if (recordPoint1.x < viewPort.visibleArea.bottomLeft.x || recordPoint1.x > viewPort.visibleArea.bottomRight.x) {
                        continue;
                    }

                    recordPoint1 = viewPort.fitIntoVisibleArea(recordPoint1);
                    recordPoint2 = viewPort.fitIntoVisibleArea(recordPoint2);
                    recordPoint3 = viewPort.fitIntoVisibleArea(recordPoint3);
                    recordPoint4 = viewPort.fitIntoVisibleArea(recordPoint4);
                    recordPoint5 = viewPort.fitIntoVisibleArea(recordPoint5);
                    recordPoint6 = viewPort.fitIntoVisibleArea(recordPoint6);
                    recordPoint7 = viewPort.fitIntoVisibleArea(recordPoint7);

                    /* Next we are drawing the stopLoss floor / ceilling */

                    browserCanvasContext.beginPath();

                    browserCanvasContext.moveTo(recordPoint4.x, recordPoint4.y);
                    browserCanvasContext.lineTo(recordPoint5.x, recordPoint5.y);

                    browserCanvasContext.closePath();

                    browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.RUSTED_RED + ', 1)';

                    if (datetime !== undefined) {
                        let dateValue = datetime.valueOf();
                        if (dateValue >= record.begin && dateValue <= record.end) {

                            /* highlight the current record */
                            browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.TITANIUM_YELLOW + ', 1)'; // Current record accroding to time
                        } 
                    }

                    browserCanvasContext.lineWidth = 1
                    browserCanvasContext.stroke()

                    /* Next we are drawing the sellRate */

                    browserCanvasContext.beginPath();

                    browserCanvasContext.moveTo(recordPoint6.x, recordPoint6.y);
                    browserCanvasContext.lineTo(recordPoint7.x, recordPoint7.y);

                    browserCanvasContext.closePath();

                    browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.GREEN + ', 1)';

                    if (datetime !== undefined) {
                        let dateValue = datetime.valueOf();
                        if (dateValue >= record.begin && dateValue <= record.end) {

                            /* highlight the current record */
                            browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.TITANIUM_YELLOW + ', 1)'; // Current record accroding to time
                        }
                    }

                    browserCanvasContext.lineWidth = 1
                    browserCanvasContext.stroke()

                    /* Continue with the pins */

                    if (record.type !== '') {

                        /* Next we are drawing the stick */

                        browserCanvasContext.beginPath();

                        browserCanvasContext.moveTo(recordPoint1.x, recordPoint1.y);
                        browserCanvasContext.lineTo(recordPoint2.x, recordPoint2.y);

                        browserCanvasContext.closePath();


                        if (datetime !== undefined) {
                            let dateValue = datetime.valueOf();
                            if (dateValue >= record.begin && dateValue <= record.end) {

                                /* highlight the current record */
                                browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.TITANIUM_YELLOW + ', 1)'; // Current record accroding to time

                                let currentRecord = {
                                    innerRecord: record
                                };
                                thisObject.container.eventHandler.raiseEvent("Current Record Changed", currentRecord);
                            } else {
                                browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.DARK + ', 1)';
                            }
                        } else {
                            browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.DARK + ', 1)';
                        }

                        browserCanvasContext.setLineDash([4, 2])
                        browserCanvasContext.lineWidth = 0.2
                        browserCanvasContext.stroke()
                        browserCanvasContext.setLineDash([0, 0])

                        /* We will draw a circle */

                        let radius = 5;
                        let color = UI_COLOR.DARK;

                        if (record.type === 'Buy') { color = UI_COLOR.GREEN; }
                        if (record.type === 'Sell-1') { color = UI_COLOR.RUSTED_RED; }
                        if (record.type === 'Sell-2') { color = UI_COLOR.MANGANESE_PURPLE; }
                        if (record.type === 'Pre-Sell') { color = UI_COLOR.GOLDEN_ORANGE; }

                        browserCanvasContext.beginPath();

                        // browserCanvasContext.moveTo(recordPoint3.x, recordPoint3.y);
                        browserCanvasContext.arc(recordPoint3.x, recordPoint3.y, radius, 0, Math.PI * 2, true);

                        browserCanvasContext.closePath();

                        if (datetime !== undefined) {
                            let dateValue = datetime.valueOf();
                            if (dateValue >= record.begin && dateValue <= record.end) {
                                /* highlight the current record */
                                browserCanvasContext.fillStyle = 'rgba(' + UI_COLOR.TITANIUM_YELLOW + ', 1)'; // Current record accroding to time
                            } else {
                                browserCanvasContext.fillStyle = 'rgba(' + color + ', 1)';
                            }
                        } else {
                            browserCanvasContext.fillStyle = 'rgba(' + color + ', 1)';
                        }

                        if (
                            recordPoint1.x < viewPort.visibleArea.topLeft.x + 50
                            ||
                            recordPoint1.x > viewPort.visibleArea.bottomRight.x - 50
                        ) {
                            // we leave this candles without fill.
                        } else {
                            browserCanvasContext.fill();
                        }

                        if (datetime !== undefined) {
                            let dateValue = datetime.valueOf();
                            if (dateValue >= record.begin && dateValue <= record.end) {
                                /* highlight the current record */
                                browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.TITANIUM_YELLOW + ', 1)'; // Current record accroding to time
                            } else {
                                browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.DARK + ', 1)';
                            }
                        } else {
                            browserCanvasContext.strokeStyle = 'rgba(' + UI_COLOR.DARK + ', 1)';
                        }

                        browserCanvasContext.lineWidth = 0.2;
                        browserCanvasContext.stroke();

                    }
                }
            }

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] plotChart -> err.message = " + err.message); }
        }
    }


    function onZoomChanged(event) {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] onZoomChanged -> Entering function."); }

            recalculate();

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] onZoomChanged -> err.message = " + err.message); }
        }
    }

    function onOffsetChanged() {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] onOffsetChanged -> Entering function."); }

            if (Math.random() * 100 > 95) {

                recalculate()
            };

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] onOffsetChanged -> err.message = " + err.message); }
        }
    }

    function onDragFinished() {

        try {

            if (INFO_LOG === true) { logger.write("[INFO] onDragFinished -> Entering function."); }

            recalculate();

        } catch (err) {

            if (ERROR_LOG === true) { logger.write("[ERROR] onDragFinished -> err.message = " + err.message); }
        }
    }
}

