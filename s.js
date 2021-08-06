const _ = require('lodash')
const COGNEX_STRATEGY = [
  { travel: 0.5 },
  { workingWeekdays: 0.5 },
  { workingWeekend: 2 },
  { workingWeekdays: 0.5 },
  { travel: 0.5 }
]
const STATIONS = [
  {
    id: 1,
    number_stations: 1,
    installation_days_cognex: 2,
    commissioning_days_cognex: 3
  },
  {
    id: 2,
    number_stations: 2,
    installation_days_cognex: 3,
    commissioning_days_cognex: 1.5
  }
]

const prepareStations = _.chain(STATIONS)
  .map(station =>
    _.times(_.get(station, 'number_stations', 0), idx => ({
      id: _.get(station, 'id'),
      stationCopyNumber: idx + 1,
      installationWeekdays: 0,
      installationWeekend: 0,
      commisionWeekdays: 0,
      commisionWeekend: 0,
      travelDays: 0,
      roundedTravelDays: 0,
      strategyCycles: 0
    }))
  )
  .flatten()
  .value()

const howToAdd = (differentDays, eventDays) => {
  if (differentDays <= eventDays) {
    return differentDays
  } else if (differentDays - eventDays < 0) {
    return differentDays
  } else {
    return eventDays
  }
}

const helperIf = (stationPlan, res, install) => {
  if (install) {
    return (
      stationPlan.installation_days_cognex !==
      res.installationWeekdays + res.installationWeekend
    )
  }
  return (
    stationPlan.commissioning_days_cognex !==
    res.commisionWeekdays + res.commisionWeekend
  )
}

const getDifferentDays = (stationPlan, res, install) => {
  if (install) {
    return (
      stationPlan.installation_days_cognex -
      (res.installationWeekdays + res.installationWeekend)
    )
  }
  return (
    stationPlan.commissioning_days_cognex -
    (res.commisionWeekdays + res.commisionWeekend)
  )
}

const startFill = (res, stationPlan) => {
  let i = 0
  let count = 0
  while (true) {
    if (count > 10) {
      return
    }
    if (i >= COGNEX_STRATEGY.length) {
      i = 0
      res.strategyCycles++
    }
    const eventName = _.keys(COGNEX_STRATEGY[i])[0]
    const eventDays = _.values(COGNEX_STRATEGY[i])[0]

    console.log(eventName, eventDays)

    switch (eventName) {
      case 'travel':
        res.roundedTravelDays += Math.ceil(eventDays)
        break
      case 'workingWeekdays':
        if (helperIf(stationPlan, res, true)) {
          const d = getDifferentDays(stationPlan, res, true)

          res.installationWeekdays += howToAdd(d, eventDays)
        } else if (helperIf(stationPlan, res, false)) {
          const d = getDifferentDays(stationPlan, res, false)

          res.commisionWeekdays += howToAdd(d, eventDays)
        }
        console.log(res)

        break
      case 'workingWeekend':
        if (helperIf(stationPlan, res, true)) {
          console.log('+')
          const d = getDifferentDays(stationPlan, res, true)

          res.installationWeekend += howToAdd(d, eventDays)
        } else if (helperIf(stationPlan, res, false)) {
          const d = getDifferentDays(stationPlan, res, false)

          res.commisionWeekend += howToAdd(d, eventDays)
        }
        console.log(res)

        break
      default:
        break
    }

    if (
      stationPlan.installation_days_cognex <=
        res.installationWeekdays + res.workingWeekend &&
      stationPlan.commissioning_days_cognex <=
        res.commisionWeekdays + res.commisionWeekend
    ) {
      return
    }
    i++
    count++
  }
}

const fillingData = stantion => {
  const res = { ...stantion }

  const stationPlan = _.filter(STATIONS, st => st.id === res.id)
  res.strategyCycles = 1

  startFill(res, stationPlan)

  res.travelDays = res.roundedTravelDays / 2

  return res
}

// const result = _.map(prepareStations, fillingData)
const f = fillingData(prepareStations[0])
//console.log(prepareStations);
// console.log(result)
