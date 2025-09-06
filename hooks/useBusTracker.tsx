import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const calculateBearing = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
};

export function useBusTracker() {
  const [userPosition, setUserPosition] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const [selectedBus, setSelectedBus] = useState<string | null>(null);
  const [busLocation, setBusLocation] = useState<any>(null);
  const [activeBuses, setActiveBuses] = useState<any[]>([]);
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBusSelector, setShowBusSelector] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(0);

  const getUserLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (error) => {
        let errorMessage = "";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
          default:
            errorMessage = "An unknown error occurred.";
            break;
        }
        setError(errorMessage);
        setLoading(false);
      },
      options
    );
  }, []);

  const fetchActiveBuses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select(
          `
          bus_id,
          driver_name,
          buses!inner (
            bus_id,
            bus_name,
            last_updated,
            route_id,
            bus_routes (
              route_id,
              route_name,
              source,
              destination
            )
          )
        `
        )
        .eq("is_on_duty", true)
        .not("bus_id", "is", null);

      if (error) {
        console.error("Error fetching active buses:", error);
        return;
      }
      const activeBusList = data.map((driver: any) => ({
        bus_id: driver.bus_id,
        bus_name: driver.buses.bus_name,
        driver_name: driver.driver_name,
        route_name: driver.buses.bus_routes?.route_name || "Unknown Route",
        source: driver.buses.bus_routes?.source || "Unknown",
        destination: driver.buses.bus_routes?.destination || "Unknown",
        last_updated: driver.buses.last_updated,
        route_id: driver.buses.route_id,
      }));

      setActiveBuses(activeBusList);
    } catch (error) {
      console.error("Error in fetchActiveBuses:", error);
    }
  }, []);

  const fetchRouteData = useCallback(async (routeId: string) => {
    try {
      const { data: route, error: routeError } = await supabase
        .from("bus_routes")
        .select("*")
        .eq("route_id", routeId)
        .single();

      if (routeError) {
        console.error("Error fetching route:", routeError);
        return;
      }

      const { data: stops, error: stopsError } = await supabase
        .from("bus_stops")
        .select("*")
        .in("stop_id", route.stop_sequence)
        .eq("is_active", true);

      if (stopsError) {
        console.error("Error fetching stops:", stopsError);
        return;
      }

      const sortedStops = route.stop_sequence
        .map((stopId: string) =>
          stops.find((stop: any) => stop.stop_id === stopId)
        )
        .filter(Boolean);

      setRouteData({
        ...route,
        stops: sortedStops,
      });
    } catch (error) {
      console.error("Error in fetchRouteData:", error);
    }
  }, []);

  const fetchBusLocation = useCallback(
    async (busId: string) => {
      try {
        const { data, error } = await supabase
          .from("bus_locations")
          .select("latitude, longitude, timestamp, heading")
          .eq("bus_id", busId)
          .order("timestamp", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          setBusLocation(null);
          return;
        }

        let finalHeading = data.heading;
        let shouldUpdateDatabase = false;

        if (routeData && routeData.stops && routeData.stops.length > 0) {
          const currentTargetStop = routeData.stops[currentStopIndex];

          if (currentTargetStop) {
            const distanceToTarget = calculateDistance(
              data.latitude,
              data.longitude,
              currentTargetStop.latitude,
              currentTargetStop.longitude
            );

            if (distanceToTarget <= 50) {
              const nextStopIndex =
                (currentStopIndex + 1) % routeData.stops.length;
              const nextStop = routeData.stops[nextStopIndex];
              setCurrentStopIndex(nextStopIndex);

              if (nextStop) {
                finalHeading = calculateBearing(
                  data.latitude,
                  data.longitude,
                  nextStop.latitude,
                  nextStop.longitude
                );
                shouldUpdateDatabase = true;
              }
            }
          }
        }

        setBusLocation({
          ...data,
          heading: finalHeading,
        });

        if (shouldUpdateDatabase && finalHeading !== null) {
          try {
            await supabase
              .from("bus_locations")
              .update({ heading: finalHeading })
              .eq("bus_id", busId)
              .eq("timestamp", data.timestamp);
          } catch (updateError) {
            console.error("Error updating heading in database:", updateError);
          }
        }
      } catch (error) {
        console.error("Error in fetchBusLocation:", error);
        setBusLocation(null);
      }
    },
    [routeData, currentStopIndex]
  );

  const handleBusSelect = useCallback(
    (busId: string) => {
      setSelectedBus(busId);
      setShowBusSelector(false);
      setCurrentStopIndex(0);

      const selectedBusInfo = activeBuses.find((bus) => bus.bus_id === busId);
      if (selectedBusInfo?.route_id) {
        fetchRouteData(selectedBusInfo.route_id);
      }
    },
    [activeBuses, fetchRouteData]
  );

  useEffect(() => {
    if (!selectedBus) return;
    fetchBusLocation(selectedBus);
    const interval = setInterval(() => {
      fetchBusLocation(selectedBus);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedBus, fetchBusLocation]);

  useEffect(() => {
    if (selectedBus && routeData) {
      fetchBusLocation(selectedBus);
    }
  }, [routeData, selectedBus, fetchBusLocation]);

  useEffect(() => {
    getUserLocation();
    fetchActiveBuses();
    const interval = setInterval(fetchActiveBuses, 30000);
    return () => clearInterval(interval);
  }, [getUserLocation, fetchActiveBuses]);

  const getNextStop = useCallback(() => {
    if (!routeData || !routeData.stops || routeData.stops.length === 0)
      return null;

    return routeData.stops[currentStopIndex];
  }, [routeData, currentStopIndex]);

  return {
    userPosition,
    selectedBus,
    busLocation,
    activeBuses,
    routeData,
    loading,
    error,
    showBusSelector,
    setShowBusSelector,
    handleBusSelect,
    getUserLocation,
    setSelectedBus,
    setBusLocation,
    setRouteData,
    getNextStop,
    currentStopIndex,
  };
}
