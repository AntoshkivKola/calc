const _ = require("lodash");
const COGNEX_STRATEGY = [
    { travel: 0.5 },
    { workingWeekdays: 0.5 },
    { workingWeekend: 2 },
    { workingWeekdays: 0.5 },
    { travel: 0.5 },
];
const STATIONS = [
    {
        id: 1,
        number_stations: 1,
        installation_days_cognex: 2,
        commissioning_days_cognex: 3,
    },
    {
        id: 2,
        number_stations: 2,
        installation_days_cognex: 3,
        commissioning_days_cognex: 1.5,
    },
];

const prepareStations = _.chain(STATIONS)
    .map((station) =>
        _.times(_.get(station, "number_stations", 0), (idx) => ({
            id: _.get(station, "id"),
            stationCopyNumber: idx + 1,
            installationWeekdays: 0,
            installationWeekend: 0,
            commisionWeekdays: 0,
            commisionWeekend: 0,
            travelDays: 0,
            roundedTravelDays: 0,
            strategyCycles: 0,
        }))
    )
    .flatten()
    .value();

const howToAdd = (differentDays, eventDays) => {
    if (differentDays <= eventDays) {
        return differentDays;
    } else if (differentDays - eventDays < 0) {
        return differentDays;
    } else {
        return eventDays;
    }
};

const startFill = (res, stationPlan) => {
    let i = 0;
    let count = 0;
    while (true) {
        if (count > 10) {
            return;
        }
        if (i >= COGNEX_STRATEGY.length) {
            i = 0;
            res.strategyCycles++;
        }
        const eventName = _.keys(COGNEX_STRATEGY[i])[0];
        const eventDays = _.values(COGNEX_STRATEGY[i])[0];

        console.log(eventName, eventDays);

        switch (eventName) {
            case "travel":
                res.roundedTravelDays += Math.ceil(eventDays);
                break;
            case "workingWeekdays":
                if (
                    stationPlan.installation_days_cognex !==
                    res.installationWeekdays + res.installationWeekend
                ) {
                    const d =
                        stationPlan.installation_days_cognex -
                        (res.installationWeekdays + res.installationWeekend);

                    res.installationWeekdays += howToAdd(d, eventDays);
                } else if (
                    stationPlan.commissioning_days_cognex !==
                    res.commisionWeekdays + res.commisionWeekend
                ) {
                    const d =
                        stationPlan.commissioning_days_cognex -
                        (res.commisionWeekdays + res.commisionWeekend);

                    res.commisionWeekdays += howToAdd(d, eventDays);
                }
                break;
            case "workingWeekend":
                if (
                    res.installationWeekdays + res.installationWeekend !==
                    stationPlan.installation_days_cognex
                ) {
                    console.log("+");
                    const d =
                        stationPlan.installation_days_cognex -
                        (res.installationWeekdays + res.installationWeekend);

                    res.installationWeekend += howToAdd(d, eventDays);
                } else if (
                    res.commisionWeekdays + res.commisionWeekend !==
                    stationPlan.commissioning_days_cognex
                ) {
                    const d =
                        stationPlan.commissioning_days_cognex -
                        (res.commisionWeekdays + res.commisionWeekend);

                    res.commisionWeekend += howToAdd(d, eventDays);
                }
                break;
            default:
                break;
        }
        console.log(res);

        if (
            stationPlan.installation_days_cognex <=
                res.installationWeekdays + res.workingWeekend &&
            stationPlan.commissioning_days_cognex <=
                res.commisionWeekdays + res.commisionWeekend
        ) {
            return;
        }
        i++;
        count++;
    }
};

const fillingData = (stantion) => {
    const res = { ...stantion };

    const stationPlan = _.filter(STATIONS, (st) => st.id === res.id);
    res.strategyCycles = 1;

    startFill(res, stationPlan);

    res.travelDays = res.roundedTravelDays / 2;

    return res;
};

const result = _.map(prepareStations, fillingData);

//console.log(prepareStations);
console.log(result);
