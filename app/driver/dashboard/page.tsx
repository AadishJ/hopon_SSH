"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { BusWithRoute, Driver } from "@/types/types";

const QRScanner = dynamic(() => import("@/components/QRScanner"), {
  ssr: false,
  loading: () => <div className="text-center p-4">Loading QR Scanner...</div>,
});

interface LocationData {
  bus_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  timestamp: string;
}

export default function DriverDashboard() {
  const [driverInfo, setDriverInfo] = useState<Driver | null>(null);
  const [busInfo, setBusInfo] = useState<BusWithRoute | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState<NodeJS.Timeout | null>(
    null
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [dutyStatus, setDutyStatus] = useState<"off" | "scanning" | "on">(
    "off"
  );
  const router = useRouter();

  useEffect(() => {
    const driverData = localStorage.getItem("driverInfo");
    const token = localStorage.getItem("driverToken");

    if (!driverData || !token) {
      router.push("/driver/login");
      return;
    }

    const parsedDriverInfo = JSON.parse(driverData) as Driver;
    setDriverInfo(parsedDriverInfo);

    // Check if driver was already on duty
    if (parsedDriverInfo.is_on_duty && parsedDriverInfo.bus_id) {
      setIsTracking(true);
      setDutyStatus("on");
      fetchBusInfo(parsedDriverInfo.bus_id);
      startLocationTracking(parsedDriverInfo.bus_id);
    }
  }, [router]);

  const fetchBusInfo = async (busId: string) => {
    try {
      console.log("Fetching bus info for:", busId);

      // Get the bus data
      const { data: bus, error: busError } = await supabase
        .from("buses")
        .select(
          `
        bus_id,
        bus_name,
        route_id,
        avg_speed,
        is_active,
        last_updated,
        created_at
      `
        )
        .eq("bus_id", busId)
        .single();

      if (busError) {
        console.error("Bus fetch error:", busError);
        throw busError;
      }

      console.log("Bus data:", bus);

      // Get the route data
      const { data: route, error: routeError } = await supabase
        .from("bus_routes")
        .select(
          `
        route_name,
        source,
        destination
      `
        )
        .eq("route_id", bus.route_id)
        .single();

      if (routeError) {
        console.error("Route fetch error:", routeError);
      }

      console.log("Route data:", route);

      // Combine the data
      const busWithRoute: BusWithRoute = {
        ...bus,
        bus_routes: route || {
          route_name: "Unknown Route",
          source: "Unknown",
          destination: "Unknown",
        },
      };

      console.log("Final bus info:", busWithRoute);
      setBusInfo(busWithRoute);
    } catch (error) {
      console.error("Error fetching bus info:", error);
    }
  };

  const handleStartShift = () => {
    setShowQRScanner(true);
    setDutyStatus("scanning");
  };

  const handleQRScan = async (scannedData: string) => {
    try {
      // Close QR scanner IMMEDIATELY to stop camera
      setShowQRScanner(false);

      let busId: string;

      try {
        const qrData = JSON.parse(scannedData);
        busId = qrData.bus_id || qrData.busId;
      } catch {
        busId = scannedData.trim();
      }

      if (!busId) {
        alert("Invalid QR code. Bus ID not found.");
        setDutyStatus("off");
        return;
      }

      // Show loading state
      setDutyStatus("scanning");

      // Verify the bus exists and is active
      const { data: bus, error } = await supabase
        .from("buses")
        .select("*")
        .eq("bus_id", busId)
        .eq("is_active", true)
        .single();

      if (error || !bus) {
        alert(
          `Bus ${busId} not found or inactive. Please scan a valid bus QR code.`
        );
        setDutyStatus("off");
        return;
      }

      // Check if another driver is already on duty with this bus
      const { data: activeDriver, error: driverCheckError } = await supabase
        .from("drivers")
        .select("driver_id, driver_name")
        .eq("bus_id", busId)
        .eq("is_on_duty", true)
        .neq("driver_id", driverInfo?.driver_id);

      if (driverCheckError) {
        console.error("Error checking active drivers:", driverCheckError);
      }

      if (activeDriver && activeDriver.length > 0) {
        alert(
          `Bus ${busId} is already being driven by ${activeDriver[0].driver_name}. Please scan a different bus.`
        );
        setDutyStatus("off");
        return;
      }

      // Start duty with this bus
      await startDuty(busId);
    } catch (error) {
      console.error("QR scan error:", error);
      alert("Failed to process QR code. Please try again.");
      setDutyStatus("off");
    }
  };

  const startDuty = async (busId: string) => {
    try {
      if (!driverInfo) return;

      console.log(
        `Starting duty with bus ${busId} for driver ${driverInfo.driver_id}`
      );

      // Update driver status to on duty with current bus
      const { error } = await supabase
        .from("drivers")
        .update({
          is_on_duty: true,
          bus_id: busId,
        })
        .eq("driver_id", driverInfo.driver_id);

      if (error) {
        console.error("Database update error:", error);
        throw error;
      }

      console.log("Database updated successfully");

      // Update local state
      const updatedDriverInfo: Driver = {
        ...driverInfo,
        is_on_duty: true,
        bus_id: busId,
      };
      setDriverInfo(updatedDriverInfo);
      localStorage.setItem("driverInfo", JSON.stringify(updatedDriverInfo));

      // Fetch and set bus info
      await fetchBusInfo(busId);

      setIsTracking(true);
      setDutyStatus("on");
      startLocationTracking(busId);

      console.log(`Duty started successfully with bus ${busId}`);
    } catch (error) {
      console.error("Error starting duty:", error);
      alert("Failed to start duty. Please try again.");
      setDutyStatus("off");
    }
  };

  const startLocationTracking = async (busId: string) => {
    console.log("Starting location tracking for bus:", busId);

    // Keep screen awake - THIS IS THE KEY!
    try {
        if ("wakeLock" in navigator) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lock = await(navigator as any).wakeLock.request("screen");
          setWakeLock(lock);
          console.log("Wake lock acquired - screen will stay on");
        }
    } catch (err) {
      console.log("Wake lock failed (older device):", err);
    }

    const sendLocationUpdate = async () => {
      if (!navigator.geolocation) {
        console.error("Geolocation not supported");
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const locationData: LocationData = {
            bus_id: busId,
            latitude: Number(position.coords.latitude),
            longitude: Number(position.coords.longitude),
            heading: position.coords.heading
              ? Number(position.coords.heading)
              : null,
            timestamp: new Date().toISOString(),
          };

          setLastLocation(locationData);

          try {
            const { error } = await supabase
              .from("bus_locations")
              .insert([locationData]);

            if (error) {
              console.error("Error inserting location:", error);
            } else {
              console.log("Location updated successfully");
            }
          } catch (error) {
            console.error("Location update error:", error);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        options
      );
    };

    sendLocationUpdate();
    const intervalId = setInterval(sendLocationUpdate, 10000);
    setLocationWatchId(intervalId);
  };

  const endShift = async () => {
    try {
      if (!driverInfo) return;

      // Stop location tracking
      if (locationWatchId) {
        clearInterval(locationWatchId);
        setLocationWatchId(null);
      }

      // Release wake lock - IMPORTANT!
      if (wakeLock) {
        wakeLock.release();
        setWakeLock(null);
        console.log("Wake lock released");
      }

      // Rest of your existing endShift code...
      const { error } = await supabase
        .from("drivers")
        .update({
          is_on_duty: false,
          bus_id: null,
        })
        .eq("driver_id", driverInfo.driver_id);

      if (error) throw error;

      const updatedDriverInfo: Driver = {
        ...driverInfo,
        is_on_duty: false,
        bus_id: null,
      };
      setDriverInfo(updatedDriverInfo);
      localStorage.setItem("driverInfo", JSON.stringify(updatedDriverInfo));

      setIsTracking(false);
      setDutyStatus("off");
      setLastLocation(null);
      setBusInfo(null);

      console.log("Shift ended successfully");
    } catch (error) {
      console.error("Error ending shift:", error);
      alert("Failed to end shift. Please try again.");
    }
  };

  const handleLogout = async () => {
    // End shift if on duty
    if (isTracking && driverInfo?.is_on_duty) {
      await endShift();
    }

    // Stop location tracking
    if (locationWatchId) {
      clearInterval(locationWatchId);
    }

    localStorage.removeItem("driverToken");
    localStorage.removeItem("driverInfo");
    router.push("/driver/login");
  };

  const handleCancelQR = () => {
    setShowQRScanner(false);
    setDutyStatus("off");
  };

  if (!driverInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Driver Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Welcome, {driverInfo.driver_name}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Current Assignment Card */}
        {busInfo ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Current Assignment</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Bus:</span>
                <span className="font-medium">{busInfo.bus_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bus ID:</span>
                <span className="font-medium">{busInfo.bus_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Route:</span>
                <span className="font-medium">
                  {busInfo.bus_routes?.route_name || "Unknown Route"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Path:</span>
                <span className="font-medium text-sm">
                  {busInfo.bus_routes?.source || "Unknown"} →{" "}
                  {busInfo.bus_routes?.destination || "Unknown"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">No Bus Assigned</h2>
            <p className="text-gray-600">
              Scan a bus QR code to start your shift.
            </p>
          </div>
        )}

        {/* Duty Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Duty Status</h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                dutyStatus === "on"
                  ? "bg-green-100 text-green-800"
                  : dutyStatus === "scanning"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {dutyStatus === "on"
                ? "On Duty"
                : dutyStatus === "scanning"
                ? "Scanning QR"
                : "Off Duty"}
            </span>
          </div>

          {dutyStatus === "off" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Scan any available bus QR code to start your shift
              </p>
              <button
                onClick={handleStartShift}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-300"
              >
                Start Shift - Scan Any Bus
              </button>
            </div>
          )}

          {dutyStatus === "on" && (
            <div className="space-y-4">
              {lastLocation && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Current Location</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Lat: {lastLocation.latitude.toFixed(6)}</div>
                    <div>Lng: {lastLocation.longitude.toFixed(6)}</div>
                    {lastLocation.heading && (
                      <div>Heading: {lastLocation.heading.toFixed(0)}°</div>
                    )}
                    <div>
                      Last Update:{" "}
                      {new Date(lastLocation.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={endShift}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-300"
              >
                End Shift
              </button>
            </div>
          )}
        </div>

        {/* QR Scanner Modal */}
        {showQRScanner && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Scan Bus QR Code</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Point your camera at any available bus QR code
                </p>
              </div>

              <QRScanner key={`qr-${Date.now()}`} onScan={handleQRScan} />

              <button
                onClick={handleCancelQR}
                className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
