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
    installation_days_cognex: 3,
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

const addTravelDays = (station) => {
  const travelDays = _.values(COGNEX_STRATEGY[0])[0];
  station.roundedTravelDays += Math.ceil(travelDays);
  station.travelDays += travelDays;
  return station;
};
/**
 * Function that determines how much to add to the current value
 * @param {number} daysNeedToFill
 * @param {number} availableDays
 * @returns
 */
const getDaysToAdd = (daysNeedToFill, availableDays) => {
  if (daysNeedToFill <= availableDays) {
    return daysNeedToFill;
  }
  return availableDays;
};

/**
 * Checks if the event is over
 * @param {object} stationPlan
 * @param {object} station
 * @param {boolean} install
 * @returns
 */
const isEventOver = (stationPlan, station, install) => {
  if (install) {
    return (
      stationPlan.installation_days_cognex ===
      station.installationWeekdays + station.installationWeekend
    );
  }
  return (
    stationPlan.commissioning_days_cognex ===
    station.commisionWeekdays + station.commisionWeekend
  );
};

/**
 * Get the number of days it takes to finish the event
 * @param {object} stationPlan
 * @param {object} station
 * @param {string} eventType
 * @param {number} dayNumber
 * @returns
 */
const getDaysToFill = (stationPlan, station, eventType, dayNumber = 0) => {
  if (eventType === "installation") {
    return (
      stationPlan.installation_days_cognex -
      (station.installationWeekdays + station.installationWeekend)
    );
  } else if (eventType === "commissioning") {
    return (
      stationPlan.commissioning_days_cognex -
      (station.commisionWeekdays + station.commisionWeekend)
    );
  } else if (eventType === "travel") {
    return _.values(COGNEX_STRATEGY[dayNumber])[0];
  }
  return 0;
};

/**
 * Add the correct number of days to the station
 * @param {object} station
 * @param {object} stationPlan
 * @param {string} property1
 * @param {string} property2
 * @param {number} howDaysLeftInCurrentEvent
 * @param {number} eventDays
 * @returns howDaysLeftInCurrentEvent
 */
const addEventDaysToStation = (
  station,
  stationPlan,
  property1,
  property2,
  howDaysLeftInCurrentEvent,
  eventDays
) => {
  if (!isEventOver(stationPlan, station, true)) {
    const daysToFill = getDaysToFill(stationPlan, station, "installation");
    station[property1] += getDaysToAdd(daysToFill, howDaysLeftInCurrentEvent);

    return (howDaysLeftInCurrentEvent =
      howDaysLeftInCurrentEvent - getDaysToAdd(daysToFill, eventDays));
  } else if (!isEventOver(stationPlan, station, false)) {
    const daysToFill = getDaysToFill(stationPlan, station, "commissioning");
    station[property2] += getDaysToAdd(daysToFill, howDaysLeftInCurrentEvent);

    return (howDaysLeftInCurrentEvent =
      howDaysLeftInCurrentEvent - getDaysToAdd(daysToFill, eventDays));
  }
};

/**
 * Fills the station with data, returns the index of the current event and the number of days left in the current event
 * @param {object} station
 * @param {object} stationPlan
 * @param {number} dayNumber
 * @param {number} howDaysLeftInCurrentEvent
 * @returns
 */
const startFill = (
  station,
  stationPlan,
  dayNumber,
  howDaysLeftInCurrentEvent
) => {
  let isFirstEvent = true;
  let eventName;
  let eventDays;

  if (dayNumber === 0) {
    station.strategyCycles = 1;
  }

  while (true) {
    if (dayNumber >= COGNEX_STRATEGY.length) {
      dayNumber = 0;
      station.strategyCycles++;
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
        addTravelDays(station);
        const daysToFill = getDaysToFill(stationPlan, station, "travel", dayNumber);
        howDaysLeftInCurrentEvent =
          eventDays - getDaysToAdd(daysToFill, eventDays);
        break;

      case "workingWeekdays":
        howDaysLeftInCurrentEvent = addEventDaysToStation(
          station,
          stationPlan,
          "installationWeekdays",
          "commisionWeekdays",
          howDaysLeftInCurrentEvent,
          eventDays
        );
        break;

      case "workingWeekend":
        howDaysLeftInCurrentEvent = addEventDaysToStation(
          station,
          stationPlan,
          "installationWeekend",
          "commisionWeekend",
          howDaysLeftInCurrentEvent,
          eventDays
        );
        break;

      default:
        break;
    }

    if (
      isEventOver(stationPlan, station, true) &&
      isEventOver(stationPlan, station, false)
    ) {
      if (dayNumber === COGNEX_STRATEGY.length - 2) {
        addTravelDays(station);
        dayNumber = 0;
      }
      return [dayNumber, howDaysLeftInCurrentEvent];
    }

    if (howDaysLeftInCurrentEvent > 0) {
      continue;
    }

    dayNumber++;
    isFirstEvent = false;
  }
};

/**
 * Wrapper function to create a closure
 * @returns
 */
const foo = () => {
  let eventNumber = 0;
  let howDaysLeftInCurrentEvent = 0;

  return (stantion) => {
    const stationPlan = _.filter(STATIONS, (st) => st.id === stantion.id)[0];

    response = startFill(
      stantion,
      stationPlan,
      eventNumber,
      howDaysLeftInCurrentEvent
    );
    eventNumber = response[0];
    howDaysLeftInCurrentEvent = response[1];

    return stantion;
  };
};

/**
 * Adds last travel if needed
 * @param {object[]} stations
 * @returns
 */
const checkTravel = (stations) => {
  let countTravel = 0;

  stations.forEach((station) => {
    countTravel += station.roundedTravelDays;
  });

  if (countTravel % 2 === 0) {
    return stations;
  }
  addTravelDays(stations[stations.length - 1]);
  return stations;
};

/**
 * Adds the values of stations with the same ID
 * @param {object[]} stantions
 * @returns
 */
const sum = (stantions) => {
  return _.chain(stantions)
    .groupBy("id")
    .map((stantion) => {
      return _.reduce(
        stantion,
        (result, currentStation) => ({
          id: currentStation.id,
          installationWeekdays:
            result.installationWeekdays + currentStation.installationWeekdays,
          installationWeekend:
            result.installationWeekend + currentStation.installationWeekend,
          commisionWeekdays:
            result.commisionWeekdays + currentStation.commisionWeekdays,
          commisionWeekend:
            result.commisionWeekend + currentStation.commisionWeekend,
          travelDays: result.travelDays + currentStation.travelDays,
          roundedTravelDays:
            result.roundedTravelDays + currentStation.roundedTravelDays,
          strategyCycles: result.strategyCycles + currentStation.strategyCycles,
        }),
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
};

const fillingData = foo();
const result = sum(checkTravel(_.map(prepareStations, fillingData)));

console.log(result);
