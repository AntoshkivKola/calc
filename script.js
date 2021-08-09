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
    installation_days_external: 2,
    commissioning_days_external: 3,
  },
  {
    id: 2,
    number_stations: 2,
    installation_days_cognex: 3,
    commissioning_days_cognex: 1.5,
    installation_days_external: 3,
    commissioning_days_external: 1.5,
  },
];
const COSTS = {
  cognex_number_of_persons_onsite: 2, // каждое значение должно быть умноженно на это число
  cognex_installation_week_day_cost: 100, // по названия понятно
  cognex_installation_weekend_day_cost: 101, // по названия понятно
  cognex_commissioning_week_day_cost: 102, // по названия понятно
  cognex_commissioning_weekend_day_cost: 103, // по названия понятно
  cognex_travel_labor_day_cost: 108, // по названия понятно (сюда округленные вставляем)
  cognex_ticket_cost: 110, // 'это цена одного трипа, то есть strategyCycle
  cognex_per_diem_day_cost: 112, // оплата за день (то есть это нужно будет умножить на * (inst + instWe + comm + commWe + travelDays))  - тут тревеллы неокругленные юзеаем, а фактические
  //
  external_number_of_persons_onsite: 3,
  external_installation_week_day_cost: 104,
  external_installation_weekend_day_cost: 105,
  external_commissioning_week_day_cost: 106,
  external_commissioning_weekend_day_cost: 107,
  external_travel_labor_day_cost: 109,
  external_ticket_cost: 111,
  external_per_diem_day_cost: 113,
};

const EVENT_TYPES = {
  TRAVEL: "travel",
  INSTALLATION: "installation",
  COMMISSIONING: "commissioning",
};

const EVENT_NAMES = {
  TRAVEL: "travel",
  WORKING_WEEKDAYS: "workingWeekdays",
  WORKING_WEEKEND: "workingWeekend",
};

const prepareStations = (stations) =>
  _.chain(stations)
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

const addTravelDays = (station, eventIdx, strategy) => {
  const travelDays = _.chain(strategy[eventIdx]).values().first();
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
      stationPlan.installation_days ===
      station.installationWeekdays + station.installationWeekend
    );
  }
  return (
    stationPlan.commissioning_days ===
    station.commisionWeekdays + station.commisionWeekend
  );
};

/**
 * Adds the values of stations with the same ID
 * @param {object[]} stations
 * @returns
 */
const sum = (stations, isGeneralSum) => {
  let stationsSum = _.chain(stations);
  if (isGeneralSum) {
    stationsSum = stationsSum.groupBy();
  } else {
    stationsSum = stationsSum.groupBy("id");
  }
  return stationsSum
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

/**
 * Prepares the object by removing unnecessary fields and renaming the field depending on the type
 * @param {object} obj
 * @param {string} type
 * @param {string} objType
 * @returns
 */
const prepareObject = (obj, type, objType) => {
  const isStation = objType === "station";

  const preparedObj = _.chain(obj)
    .mapKeys((value, key) => {
      if (_.includes(key, type)) {
        return _.replace(key, isStation ? `_${type}` : `${type}_`, "");
      }
    })
    .omit("undefined")
    .value();

  if (isStation) {
    _.assign(preparedObj, {
      id: obj.id,
      number_stations: obj.number_stations,
    });
  }

  return preparedObj;
};
const isEmptyStation = (station) => {
  return (
    _.get(station, "installation_days") === 0 &&
    _.get(station, "commissioning_days") === 0
  );
};
/**
 * Calculates fields values
 * @param {object} station
 * @param {object} costs
 * @param {string} stationKey
 * @param {string} costKey
 */
const calc = (station, costs, stationKey, costKey) => {
  let value =
    _.get(station, stationKey) * _.get(costs, "number_of_persons_onsite");
  const price = _.get(costs, costKey);

  switch (stationKey) {
    case "perDiem":
      // (inst + instWe + comm + commWe + travelDays)
      value = _.sum(
        _.map(
          [
            _.get(station, "installationWeekdays"),
            _.get(station, "installationWeekend"),
            _.get(station, "commisionWeekdays"),
            _.get(station, "commisionWeekend"),
            _.get(station, "travelDays"),
          ],
          (v) => v * _.get(costs, "number_of_persons_onsite")
        )
      );

      break;
    case "strategyCycles":
      return {
        value,
        price,
        extended: value * price,
        trips_to_site: _.get(station, stationKey),
        number_person: _.get(costs, "number_of_persons_onsite"),
      };
    default:
      break;
  }

  const extended = value * price;
  return { value, price, extended };
};

/**
 * Fills the resulting object with values of type {value, price, extended}
 * @param {object} stations
 * @param {object} costs
 * @returns
 */
const fillPriceList = (stations, costs) => {
  const result = _.chain(stations)
    .map((station) => ({
      id: _.get(station, "id"),
      installationWeekdays: calc(
        station,
        costs,
        "installationWeekdays",
        "installation_week_day_cost"
      ),

      installationWeekend: calc(
        station,
        costs,
        "installationWeekend",
        "installation_weekend_day_cost"
      ),
      commisionWeekdays: calc(
        station,
        costs,
        "commisionWeekdays",
        "commissioning_week_day_cost"
      ),
      commisionWeekend: calc(
        station,
        costs,
        "commisionWeekend",
        "commissioning_weekend_day_cost"
      ),
      travelDays: calc(
        station,
        costs,
        "roundedTravelDays",
        "travel_labor_day_cost"
      ),
      trips: calc(station, costs, "strategyCycles", "ticket_cost"),
      perDiem: calc(station, costs, "perDiem", "per_diem_day_cost"),
    }))
    .value();
  return result;
};

/**
 * Wrapper function to create a closure
 * @returns
 */
const fillingData = (strategy, stations, costs, calcType) => {
  const strategyIndex = {
    firstTravel: 0,
    lastWorkingEvent: strategy.length - 2,
    lastTravel: strategy.length - 1,
  };

  let eventIdx = 0;
  let daysLeftInCurrentEvent = 0;

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
      case EVENT_TYPES.INSTALLATION:
        return (
          stationPlan.installation_days -
          (station.installationWeekdays + station.installationWeekend)
        );
      case EVENT_TYPES.COMMISSIONING:
        return (
          stationPlan.commissioning_days -
          (station.commisionWeekdays + station.commisionWeekend)
        );
      case EVENT_TYPES.TRAVEL:
        return _.chain(strategy[eventIdx]).values().first();
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
      const daysToFill = getDaysToFill(
        stationPlan,
        station,
        EVENT_TYPES.INSTALLATION
      );
      station[property1] += getDaysToAdd(daysToFill, howDaysLeftInCurrentEvent);

      return (howDaysLeftInCurrentEvent =
        howDaysLeftInCurrentEvent - getDaysToAdd(daysToFill, eventDays));
    } else if (!isEventOver(stationPlan, station, false)) {
      const daysToFill = getDaysToFill(
        stationPlan,
        station,
        EVENT_TYPES.COMMISSIONING
      );
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
    strategy,
    eventIdx,
    daysLeftInCurrentEvent,
    isLastStation,
  }) => {
    let isFirstEvent = true;
    let eventName;
    let eventDays;

    if (eventIdx === 0) {
      station.strategyCycles = 1;
    }

    while (true) {
      if (eventIdx >= strategy.length) {
        eventIdx = 0;
        station.strategyCycles++;
      }

      if (daysLeftInCurrentEvent <= 0 || isFirstEvent) {
        eventName = _.chain(strategy[eventIdx]).keys().first().value();
        eventDays = _.chain(strategy[eventIdx]).values().first().value();
      }

      if (!isFirstEvent && daysLeftInCurrentEvent <= 0) {
        daysLeftInCurrentEvent = eventDays;
      }

      switch (eventName) {
        case EVENT_NAMES.TRAVEL:
          addTravelDays(station, eventIdx, strategy);
          const daysToFill = getDaysToFill(
            stationPlan,
            station,
            EVENT_TYPES.TRAVEL,
            eventIdx
          );
          daysLeftInCurrentEvent =
            eventDays - getDaysToAdd(daysToFill, eventDays);
          break;

        case EVENT_NAMES.WORKING_WEEKDAYS:
          daysLeftInCurrentEvent = addEventDaysToStation(
            station,
            stationPlan,
            "installationWeekdays",
            "commisionWeekdays",
            daysLeftInCurrentEvent,
            eventDays
          );
          break;

        case EVENT_NAMES.WORKING_WEEKEND:
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
        if (eventIdx === strategyIndex.lastWorkingEvent) {
          addTravelDays(station, eventIdx, strategy);
          eventIdx = 0;
          eventName = _.chain(strategy[eventIdx]).keys().first().value();
        }

        if (isLastStation && eventName !== EVENT_NAMES.TRAVEL) {
          addTravelDays(station, strategyIndex.lastTravel, strategy);
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
  //////////////////////////////////// EXECUTING //////////////////////////////////
  const preparedStations = prepareStations(stations);
  const prepearedCosts = prepareObject(costs, calcType, "costs");

  const result = _.chain(preparedStations)
    .map((station) => {
      const stationPlan = prepareObject(
        _.chain(stations)
          .filter((st) => st.id === station.id)
          .first()
          .value(),
        calcType,
        "station"
      );

      if (isEmptyStation(stationPlan)) {
        return;
      }

      const isLastStation = _.isEqual(station, _.last(preparedStations));

      const response = startFill({
        station,
        stationPlan,
        strategy,
        eventIdx,
        daysLeftInCurrentEvent,
        isLastStation,
      });

      eventIdx = _.get(response, "eventIdx");
      daysLeftInCurrentEvent = _.get(response, "daysLeftInCurrentEvent");

      return _.get(response, "station");
    })
    .value()
    .filter((property) => property);

  const guneralSum = _.map(
    fillPriceList(sum(result, true), prepearedCosts),
    (s) => _.omit(s, "id")
  );
  console.log("guneralSum", guneralSum);
  return fillPriceList(sum(result, false), prepearedCosts);
};

const result = fillingData(COGNEX_STRATEGY, STATIONS, COSTS, "cognex");

console.log(result);
