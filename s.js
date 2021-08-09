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

const howToAdd = (daysNeedToFill, eventDays) => {
  if (daysNeedToFill <= eventDays) {
    return daysNeedToFill;
  } else {
    return eventDays;
  }
};

const helperIf = (stationPlan, res, install) => {
  if (install) {
    return (
      stationPlan.installation_days_cognex !==
      res.installationWeekdays + res.installationWeekend
    );
  }
  return (
    stationPlan.commissioning_days_cognex !==
    res.commisionWeekdays + res.commisionWeekend
  );
};

const getDaysToFill = (stationPlan, res, eventType) => {
  if (eventType === "installation") {
    return (
      stationPlan.installation_days_cognex -
      (res.installationWeekdays + res.installationWeekend)
    );
  } else if (eventType === "commissioning") {
    return (
      stationPlan.commissioning_days_cognex -
      (res.commisionWeekdays + res.commisionWeekend)
    );
  }
  return 0.5;
};

const startFill = (res, stationPlan, dayNumber, howDaysLeftInCurrentEvent) => {
  debugger;
  let isFirstEvent = true;
  let eventName;
  let eventDays;
  while (true) {
    if (dayNumber === COGNEX_STRATEGY.length) {
      dayNumber = 0;
      res.strategyCycles++;
    }
    if (howDaysLeftInCurrentEvent <= 0 || isFirstEvent) {
      eventName = _.keys(COGNEX_STRATEGY[dayNumber])[0];
      eventDays = _.values(COGNEX_STRATEGY[dayNumber])[0];
    }
    if (!isFirstEvent && howDaysLeftInCurrentEvent <= 0) {
      howDaysLeftInCurrentEvent = eventDays;
    }

    switch (eventName) {
      case "travel":
        res.roundedTravelDays += Math.ceil(eventDays);
        const daysToFill = getDaysToFill(stationPlan, res, "travel");
        howDaysLeftInCurrentEvent = eventDays - howToAdd(daysToFill, eventDays);
        break;
      case "workingWeekdays":
        if (helperIf(stationPlan, res, true)) {
          const daysToFill = getDaysToFill(stationPlan, res, "installation");
          res.installationWeekdays += howToAdd(
            daysToFill,
            howDaysLeftInCurrentEvent
          );
          howDaysLeftInCurrentEvent =
            howDaysLeftInCurrentEvent - howToAdd(daysToFill, eventDays);
        } else if (helperIf(stationPlan, res, false)) {
          const daysToFill = getDaysToFill(stationPlan, res, "commissioning");
          res.commisionWeekdays += howToAdd(
            daysToFill,
            howDaysLeftInCurrentEvent
          );
          howDaysLeftInCurrentEvent =
            howDaysLeftInCurrentEvent - howToAdd(daysToFill, eventDays);
        }
        break;
      case "workingWeekend":
        if (helperIf(stationPlan, res, true)) {
          const daysToFill = getDaysToFill(stationPlan, res, "installation");
          res.installationWeekend += howToAdd(
            daysToFill,
            howDaysLeftInCurrentEvent
          );
          howDaysLeftInCurrentEvent =
            howDaysLeftInCurrentEvent - howToAdd(daysToFill, eventDays);
        } else if (helperIf(stationPlan, res, false)) {
          const daysToFill = getDaysToFill(stationPlan, res, "commissioning");
          res.commisionWeekend += howToAdd(
            daysToFill,
            howDaysLeftInCurrentEvent
          );

          howDaysLeftInCurrentEvent =
            howDaysLeftInCurrentEvent - howToAdd(daysToFill, eventDays);
        }
        break;
      default:
        break;
    }
    if (
      !helperIf(stationPlan, res, true) &&
      !helperIf(stationPlan, res, false)
    ) {
      return [dayNumber, howDaysLeftInCurrentEvent];
    }
    if (howDaysLeftInCurrentEvent > 0) {
      continue;
    }
    dayNumber++;
    isFirstEvent = false;
  }
};

const week = () => {
  let eventNumber = 0;
  let howDaysLeftInCurrentEvent = 0;
  return (stantion) => {
    const res = { ...stantion };

    const stationPlan = _.filter(STATIONS, (st) => st.id === res.id)[0];
    res.strategyCycles = 1;
    response = startFill(
      res,
      stationPlan,
      eventNumber,
      howDaysLeftInCurrentEvent
    );
    eventNumber = response[0];
    howDaysLeftInCurrentEvent = response[1];

    res.travelDays = res.roundedTravelDays / 2;
    return res;
  };
};

const checkTravel = (stantions) => {
  let countTravel = 0;
  stantions.forEach((stantion) => {
    countTravel += stantion.roundedTravelDays;
  });
  if (countTravel % 2 === 0) {
    return;
  }
  stantions[stantions.length - 1].roundedTravelDays += Math.ceil(
    _.values(COGNEX_STRATEGY[0])[0]
  );
  stantions[stantions.length - 1].travelDays =
    stantions[stantions.length - 1].roundedTravelDays / 2;
  return stantions;
};

const sum = (stantions) => {
  const res = _.chain(stantions)
    .groupBy("id")
    .map(function (value, key) {
      return _.reduce(
        value,
        function (result, currentObject) {
          console.log("reduce result:::", result);
          console.log("reduce currentObject::::", currentObject);
          return {
            id: currentObject.id,
            installationWeekdays:
              result.installationWeekdays + currentObject.installationWeekdays,
            installationWeekend:
              result.installationWeekend + currentObject.installationWeekend,
            commisionWeekdays:
              result.commisionWeekdays + currentObject.commisionWeekdays,
            commisionWeekend:
              result.commisionWeekend + currentObject.commisionWeekend,
            travelDays: result.travelDays + currentObject.travelDays,
            roundedTravelDays:
              result.roundedTravelDays + currentObject.roundedTravelDays,
            strategyCycles:
              result.strategyCycles + currentObject.strategyCycles,
          };
        },
        {
          id: 0,
          installationWeekdays: 0,
          installationWeekend: 0,
          commisionWeekdays: 0,
          commisionWeekend: 0,
          travelDays: 0,
          roundedTravelDays: 0,
          strategyCycles: 0,
        }
      );
    })
    .value();
  return res;
};

const fillingData = week();
const result = sum(checkTravel(_.map(prepareStations, fillingData)));

console.log(result);
