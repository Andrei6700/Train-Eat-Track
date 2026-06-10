## Overview

The Statistics screen displays tracking metrics for the user. The screen divides into two distinct tabs: workout statistics and nutrition statistics. It supports three period types: Weekly, Monthly, and Yearly. 
Workout statistics show progress in muscle building and strength over time. Nutrition statistics track daily food intake and hydration habits. These visual metrics help users analyze patterns and adjust training plans.

The main React component `Statistics` handles tab switching and track initialization. The component runs the `useEffect` hook to call `trackScreen` when mounting the screen.

```tsx
  useEffect(() => {
    trackScreen("Statistics", Date.now() - mountStartRef.current);
  }, []);
```

## Page Division

The screen layout divides into two main sections: workouts and nutrition. The root component renders both sections but controls visibility using display attributes.
The component manages tab switching through the `handleTabChange` callback function. This function updates the active tab index and switches the display state.

```tsx
  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index === 0 ? "workouts" : "nutrition");
  }, []);
```

Tab visibility uses a layout approach. The screen hides the inactive tab component using the CSS style `display: none` instead of unmounting it. This maintains the component state when switching tabs.

## Data Sources

The application retrieves data from different sources depending on the active tab. It employs caching for workouts but queries remote servers directly for nutrition.

### 3.1 Workout Data Fetching

Workout statistics retrieve data using a stale-while-revalidate pattern. The asynchronous function `fetchWorkoutsHistory` manages this data retrieval process.

The component first fetches stored workouts from the local cache using `getCachedWorkoutHistory` with `allowStale: true`. If cached data exists, the component updates the state and stops the loading indicator.

After loading the cache, the component requests fresh data from the server using `getUserWorkouts`. This remote call updates the state with the latest workouts.

```tsx
    const cacheResult = await measureAsync(
      "statistics_hydrate_cache_ms",
      () => getCachedWorkoutHistory(userId, { allowStale: true }),
      (result) => ({
        source: result.data ? "cache" : "fallback",
        itemCount: result.data?.length ?? 0,
        cacheAgeMs: result.ageMs ?? null,
        success: Boolean(result.data),
      }),
    );
```

### 3.2 Nutrition and Water Data Fetching

The nutrition statistics component loads nutrition and water logs in parallel. The asynchronous function `fetchNutritionAndWater` orchestrates this concurrent request.
The system calls `getUserNutritionHistory` and `getUserWaterHistory` inside a `Promise.all` block. This data retrieval process does not use a local cache layer.

```tsx
      const [nutritionResult, waterResult] = await Promise.all([
        getUserNutritionHistory(userId),
        getUserWaterHistory(userId),
      ]);
```

## Data Processing and Analysis

The statistics screen processes raw database entries to generate chart coordinates and summary metrics. It performs timeframe filtering, unit conversions, and data downsampling.

### 4.1 Timeframe Filtering

The helper function `getPeriodStartDate` computes a starting cutoff date based on the active `PeriodType`. It subtracts 7 days for the Weekly period, 1 month for the Monthly period, and 1 year for the Yearly period.
Workout filtering applies this cutoff directly. The `filteredWorkouts` memoized value filters out rest days and workouts with dates prior to the cutoff date, then sorts the remaining workouts chronologically.

Nutrition filtering happens during the aggregation phase. The `rawNutritionDayStats` memoized calculation compares entry dates to the cutoff date and excludes older records.

```tsx
const getPeriodStartDate = (period: PeriodType): Date => {
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);

  if (period === "Weekly") {
    periodStart.setDate(periodStart.getDate() - 7);
  } else if (period === "Monthly") {
    periodStart.setMonth(periodStart.getMonth() - 1);
  } else {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }

  return periodStart;
};
```

### 4.2 Workout Calculations

The workout statistics dashboard derives two summary metrics from the `filteredWorkouts` array. The variable `totalWorkoutsCount` counts the number of workouts in the filtered array.

The variable `totalDurationMinutes` aggregates the duration of all filtered workouts. It divides the summed duration in seconds by 60 to compute the value in minutes.

```tsx
  const totalWorkoutsCount = useMemo(() => filteredWorkouts.length, [filteredWorkouts]);
  const totalDurationMinutes = useMemo(() => {
    return filteredWorkouts.reduce(
      (sum, workout) => sum + Math.floor(workout.duration / 60),
      0
    );
  }, [filteredWorkouts]);
```

The `availableExercises` memoized array creates an alphabetically sorted list of unique exercise names. For the Weekly period, the list contains only exercises logged within the filtered timeframe.

For Monthly and Yearly periods, the list includes all exercises from the entire workout history. This design ensures all-time exercises remain selectable in longer views.

```tsx
  const availableExercises = useMemo(() => {
    const exerciseSet = new Set<string>();
    const sourceWorkouts =
      dataPeriod === "Weekly"
        ? filteredWorkouts
        : workoutsHistory.filter((w) => !w.isRestDay);

    sourceWorkouts.forEach((workout) => {
      workout.exercises?.forEach((exercise) => {
        if (exercise.exerciseName) {
          exerciseSet.add(exercise.exerciseName);
        }
      });
    });

    return Array.from(exerciseSet).sort();
  }, [workoutsHistory, filteredWorkouts, dataPeriod]);
```

The `exerciseStatsData` memoized calculation compiles statistics and chart coordinates for the selected exercise. The compiler processes each completed set and translates pounds to kilograms if the unit is lbs.

The weight conversion uses the multiplier 0.453592. The system tracks the maximum weight lifted in each session to record strength progress.

The calculation computes the total weight by multiplying weight and reps for all sets. It also tracks total repetitions and the average top set repetitions.

```tsx
        exercise.sets.forEach((set) => {
          const weight =
            set.weightUnit === "lbs" ? set.weight * 0.453592 : set.weight;

          if (weight > maxWeightThisWorkout) {
            maxWeightThisWorkout = weight;
            repsAtMaxWeightThisWorkout = set.reps;
          } else if (
            weight === maxWeightThisWorkout &&
            set.reps > repsAtMaxWeightThisWorkout
          ) {
            repsAtMaxWeightThisWorkout = set.reps;
          }

          totalWeightThisWorkout += weight * set.reps;
          totalReps += set.reps;
        });
```

### 4.3 Nutrition Aggregation and Analysis

The `rawNutritionDayStats` memoized value groups and sums nutrition logs per day. The calculator iterates through meals and foods to sum calories, protein, carbs, and fat.

The system excludes days where all macronutrients equal zero from the aggregated dataset. It then merges water logs into the daily records using the date as a key.

```tsx
      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      for (const meal of meals) {
        const foods = Array.isArray(meal.foods) ? meal.foods : [];
        for (const food of foods) {
          calories += Number(food.calories) || 0;
          protein += Number(food.protein) || 0;
          carbs += Number(food.carbs) || 0;
          fat += Number(food.fat) || 0;
        }
      }
```

The `nutritionAverages` memo calculates average metrics across five fields. The five fields are `avgCalories`, `avgProtein`, `avgCarbs`, `avgFat`, and `avgWater`.

The calculations divide totals by the count of days where calories exceed zero. Water averages use a separate denominator tracking only days with logged water.

```tsx
    const avg = (days: NutritionDayStats[], key: keyof NutritionDayStats) =>
      days.length > 0
        ? Math.round(days.reduce((s, d) => s + (d[key] as number), 0) / days.length)
        : 0;

    const result = {
      avgCalories: avg(daysWithCalories, "calories"),
      avgProtein: avg(daysWithCalories, "protein"),
      avgCarbs: avg(daysWithCalories, "carbs"),
      avgFat: avg(daysWithCalories, "fat"),
      avgWater: avg(daysWithWater, "water"),
    };
```

### 4.4 Yearly Downsampling

When the data period equals Yearly, the component downsamples the dataset to prevent layout lag. The component calls `getStartOfWeek` to determine the start of each week.

For workouts, it downsamples `chartDates`, `chartWeights`, and `chartReps` to weekly averages. This operation reduces the number of plotted coordinates on the chart.

```tsx
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
};
```

For the Yearly period, the component aggregates daily nutrition statistics into weekly groups. It calculates weekly averages for calories, protein, carbs, fat, and water.

The weekly calculations exclude daily zero values from the averages. The Weekly and Monthly periods bypass this step and pass raw aggregated data directly to the charts.

```tsx
    rawNutritionDayStats.forEach((day) => {
      const startOfWeek = getStartOfWeek(day.date);
      const key = startOfWeek.toISOString();
      const existing = weeklyGroups.get(key);
      if (existing) {
        if (day.calories > 0) existing.caloriesList.push(day.calories);
        if (day.protein > 0) existing.proteinList.push(day.protein);
        if (day.carbs > 0) existing.carbsList.push(day.carbs);
        if (day.fat > 0) existing.fatList.push(day.fat);
        if (day.water > 0) existing.waterList.push(day.water);
      } else {
        weeklyGroups.set(key, {
          caloriesList: day.calories > 0 ? [day.calories] : [],
          proteinList: day.protein > 0 ? [day.protein] : [],
          carbsList: day.carbs > 0 ? [day.carbs] : [],
          fatList: day.fat > 0 ? [day.fat] : [],
          waterList: day.water > 0 ? [day.water] : [],
          date: startOfWeek,
        });
      }
    });
```

## Period Control and Debouncing

The user selects active periods using a segmented control component. The system updates the selected period state immediately to reflect user input in the selector.

To avoid screen lag during heavy data recalculations, the component uses the React `useTransition` hook and a debounce timer. The function `handlePeriodChange` implements this debouncing logic.

```tsx
const handlePeriodChange = useCallback((period: PeriodType) => {
  setSelectedPeriod(period);
  clearTimeout(debounceTimerRef.current);
  debounceTimerRef.current = setTimeout(() => {
    startTransition(() => setDataPeriod(period));
  }, 150);
}, []);
```

## Function Descriptions and Roles

This section documents the responsibilities of the helper functions and callback utilities defined within the components.

### 5.1 Shared Utility Functions

The utility functions format dates and scale layout structures across both statistics tabs.

- `getPeriodStartDate(period)`: Calculates the starting cutoff date for Weekly, Monthly, or Yearly ranges.
- `getStartOfWeek(date)`: Finds the Monday date of the week containing the specified parameter.
- `applyLabelFiltering(points, suffix)`: Generates structured coordinates and vertical shift parameters for gifted chart labels.

```tsx
const applyLabelFiltering = (points: ChartDataPoint[], suffix: string = ""): ChartDataPoint[] => {
  return points.map((pt, idx) => {
    const shiftY = idx % 2 === 0 ? 12 : -12;

    return {
      ...pt,
      dataPointText: `${pt.value}${suffix}`,
      textShiftY: shiftY,
      textFontSize: 10,
      textColor: "#F5F5F5",
    };
  });
};
```

### 5.2 Interactive Event Handlers

The event handlers update component state based on user inputs and physical screen swipes.

- `handleTabChange(index)`: Translates segmented control selection index into active tab state values.
- `handlePeriodChange(period)`: Updates the user interface state immediately and schedules transition tasks.
- `handleSwipePeriod(direction)`: Increments or decrements the active period type when swipe triggers match thresholds.

```tsx
  const handleSwipePeriod = useCallback(
    (direction: "next" | "prev") => {
      const currentIdx = PERIODS.indexOf(selectedPeriod);
      let nextPeriod: PeriodType | null = null;
      if (direction === "next" && currentIdx < PERIODS.length - 1) {
        nextPeriod = PERIODS[currentIdx + 1];
      } else if (direction === "prev" && currentIdx > 0) {
        nextPeriod = PERIODS[currentIdx - 1];
      }
      if (nextPeriod) {
        periodChangeRef.current = {
          from: selectedPeriod,
          to: nextPeriod,
          startTime: Date.now(),
        };
        onPeriodChange(nextPeriod);
      }
    },
    [selectedPeriod, onPeriodChange]
  );
```

- `getButtonLabel(type)`: Resolves localized text keys for calorie and macronutrient toggle selector buttons.

```tsx
  const getButtonLabel = (type: NutritionChartType) => {
    switch (type) {
      case "kcal":
        return t("statistics_kcal");
      case "protein":
        return t("nutrition_protein");
      case "fat":
        return t("nutrition_fat");
      case "carbs":
        return t("nutrition_carbs");
    }
  };
```

## User Interface and Charts

The dashboard represents metrics using trend charts and metric cards. It implements visual cues like color coding and alternating labels.

The component renders two line chart instances for workouts and two for nutrition. The line chart displays a filled area below the path only if the data contains more than one point.

The component computes chart spacing dynamically using the width of the screen. The calculation uses `useWindowDimensions` and the number of data points.

```tsx
  const chartSpacing = useMemo(() => {
    const pointCount = weightChartData.length;
    if (pointCount <= 1) return scale(60);

    const usableWidth = Math.max(chartWidth - scale(60), scale(180));
    const dynamicSpacing = usableWidth / (pointCount - 1);

    return Math.max(scale(35), Math.min(scale(60), dynamicSpacing));
  }, [chartWidth, weightChartData.length]);
```

The nutrition component incorporates a macro switcher configuration. The switcher uses the configuration object `CHART_TYPE_CONFIG` to map colors and fields.

```tsx
const CHART_TYPE_CONFIG: Record<NutritionChartType, {
  color: string;
  badge: string;
  field: keyof NutritionDayStats;
  suffix: string;
}> = {
  kcal:    { color: "#FFB020", badge: "kcal",      field: "calories", suffix: "" },
  protein: { color: "#22C55E", badge: "g protein", field: "protein",  suffix: "" },
  fat:     { color: "#FFB020", badge: "g fat",     field: "fat",      suffix: "" },
  carbs:   { color: "#7B61FF", badge: "g carbs",   field: "carbs",    suffix: "" },
};
```

## Gesture Navigation

Both components implement a shared swipe gesture detector using `PanResponder`. The gesture handler monitors touch movements on the screen.

The system starts horizontal tracking when the movement exceeds a threshold of 20 pixels. The gesture triggers a period change upon release under specific conditions.

The transition requires horizontal travel greater than 80 pixels or a velocity greater than 0.3 within 300 milliseconds. Swiping left selects the next period, while swiping right selects the previous period.

```tsx
      onPanResponderRelease: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        const duration = Date.now() - swipeStartTimeRef.current;
        const isQuick = duration < 300 && Math.abs(gs.vx) > 0.3;
        const isLong = Math.abs(gs.dx) > 80;
        if (isQuick || isLong) {
          if (gs.dx < 0) {
            handleSwipePeriod("next");
          } else {
            handleSwipePeriod("prev");
          }
        }
```

## Libraries Used

The statistics screen uses external libraries to implement charting, selection controls, icons, and state management.

| Library | Purpose |
| :--- | :--- |
| `react-native-gifted-charts` | Renders line charts for weights, reps, nutrition, and water. |
| `@react-native-segmented-control/segmented-control` | Provides the period and tab selector components. |
| `phosphor-react-native` | Provides icons for statistics metrics. |
| `react` | Manages state, memoization, callback functions, and transitions. |
| `react-native` | Handles swipe gestures, layouts, and window dimension updates. |
