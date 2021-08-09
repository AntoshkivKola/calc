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
const STRATEGY_INDEX = {
  FIRST_TRAVEL: 0,
  LAST_WORKING_EVENT: COGNEX_STRATEGY.length - 2,
  LAST_TRAVEL: COGNEX_STRATEGY.length - 1,
};

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

const LAST_STATION_INDEX = prepareStations.length - 1;

const addTravelDays = (station, eventIdx) => {
  const travelDays = _.chain(COGNEX_STRATEGY[eventIdx]).values().first();
  station.roundedTravelDays += _.ceil(travelDays);
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
 * @param {number} eventIdx
 * @returns
 */
const getDaysToFill = (stationPlan, station, eventType, eventIdx = 0) => {
  switch (eventType) {
    case "installation":
      return (
        stationPlan.installation_days_cognex -
        (station.installationWeekdays + station.installationWeekend)
      );
    case "commissioning":
      return (
        stationPlan.commissioning_days_cognex -
        (station.commisionWeekdays + station.commisionWeekend)
      );
    case "travel":
      return _.chain(COGNEX_STRATEGY[eventIdx]).values().first();
    default:
      return 0;
  }
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
 * @param {number} eventIdx
 * @param {number} daysLeftInCurrentEvent
 * @returns
 */
const startFill = ({
  station,
  stationPlan,
  eventIdx,
  daysLeftInCurrentEvent,
  stationIdx,
}) => {
  let isFirstEvent = true;
  let eventName;
  let eventDays;

  if (eventIdx === 0) {
    station.strategyCycles = 1;
  }

  while (true) {
    if (eventIdx >= COGNEX_STRATEGY.length) {
      eventIdx = 0;
      station.strategyCycles++;
    }

    if (daysLeftInCurrentEvent <= 0 || isFirstEvent) {
      eventName = _.chain(COGNEX_STRATEGY[eventIdx]).keys().first().value();
      eventDays = _.chain(COGNEX_STRATEGY[eventIdx]).values().first().value();
    }

    if (!isFirstEvent && daysLeftInCurrentEvent <= 0) {
      daysLeftInCurrentEvent = eventDays;
    }

    switch (eventName) {
      case "travel":
        addTravelDays(station, eventIdx);
        const daysToFill = getDaysToFill(
          stationPlan,
          station,
          "travel",
          eventIdx
        );
        daysLeftInCurrentEvent =
          eventDays - getDaysToAdd(daysToFill, eventDays);
        break;

      case "workingWeekdays":
        daysLeftInCurrentEvent = addEventDaysToStation(
          station,
          stationPlan,
          "installationWeekdays",
          "commisionWeekdays",
          daysLeftInCurrentEvent,
          eventDays
        );
        break;

      case "workingWeekend":
        daysLeftInCurrentEvent = addEventDaysToStation(
          station,
          stationPlan,
          "installationWeekend",
          "commisionWeekend",
          daysLeftInCurrentEvent,
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
      if (eventIdx === STRATEGY_INDEX.LAST_WORKING_EVENT) {
        addTravelDays(station, eventIdx);
        eventIdx = 0;
        eventName = _.chain(COGNEX_STRATEGY[eventIdx]).keys().first().value();
      }

      if (stationIdx === LAST_STATION_INDEX && eventName !== "travel") {
        addTravelDays(station, STRATEGY_INDEX.LAST_TRAVEL);
      }

      return { station, eventIdx, daysLeftInCurrentEvent };
    }

    if (daysLeftInCurrentEvent > 0) {
      continue;
    }

    eventIdx++;
    isFirstEvent = false;
  }
};

/**
 * Wrapper function to create a closure
 * @returns
 */
const foo = () => {
  let eventIdx = 0;
  let daysLeftInCurrentEvent = 0;

  return (stations) => {
    const result = _.map(stations, (station, stationIdx) => {
      const stationPlan = _.chain(STATIONS)
        .filter((st) => st.id === station.id)
        .first()
        .value();

      const response = startFill({
        station,
        stationPlan,
        eventIdx,
        daysLeftInCurrentEvent,
        stationIdx,
      });

      eventIdx = _.get(response, "eventIdx");
      daysLeftInCurrentEvent = _.get(response, "daysLeftInCurrentEvent");

      return _.get(response, "station");
    });

    return result;
  };
};

/**
 * Adds the values of stations with the same ID
 * @param {object[]} stations
 * @returns
 */
const sum = (stations) => {
  return _.chain(stations)
    .groupBy("id")
    .map((station, id) => {
      return {
        id: parseInt(id),
        installationWeekdays: _.sumBy(station, "installationWeekdays"),
        installationWeekend: _.sumBy(station, "installationWeekend"),
        commisionWeekdays: _.sumBy(station, "commisionWeekdays"),
        commisionWeekend: _.sumBy(station, "commisionWeekend"),
        travelDays: _.sumBy(station, "travelDays"),
        roundedTravelDays: _.sumBy(station, "roundedTravelDays"),
        strategyCycles: _.sumBy(station, "strategyCycles"),
      };
    })
    .value();
};

const fillingData = foo();
const result = sum(fillingData(prepareStations));

console.log(result);
