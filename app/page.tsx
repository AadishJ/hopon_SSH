"use client";
import React from "react";
import dynamic from "next/dynamic";
import { useBusTracker } from "@/hooks/useBusTracker";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="p-4 flex items-center justify-center h-screen">
      Loading map...
    </div>
  ),
});

const Page = () => {
  const {
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
  } = useBusTracker();

  const displayPosition = busLocation
    ? { lat: busLocation.latitude, lng: busLocation.longitude }
    : userPosition;

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-screen">
        <div>Loading your location...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={getUserLocation}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!displayPosition) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-screen">
        <div className="mb-4">Unable to get location</div>
        <button
          onClick={getUserLocation}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  const selectedBusInfo = activeBuses.find((bus) => bus.bus_id === selectedBus);
  const nextStop = getNextStop();

  return (
    <div className="h-screen w-full relative overflow-hidden">
      {/* Control Buttons - Fixed positioning for mobile */}
      <div className="fixed bottom-4 left-4 right-4 z-[1000] w-fit flex justify-between gap-2 pointer-events-none">
        <button
          onClick={() => setShowBusSelector(true)}
          className="px-3 py-2 sm:px-4 sm:py-2 w-fit bg-green-500 text-white rounded hover:bg-green-600 shadow-lg text-sm sm:text-base pointer-events-auto flex-1 max-w-[140px] sm:max-w-none"
        >
          {selectedBus ? `Bus: ${selectedBusInfo?.bus_name}` : "Select Bus"}
        </button>

        <button
          onClick={getUserLocation}
          className="px-3 py-2 bg-blue-500 text-white rounded text-xs sm:text-sm hover:bg-blue-600 shadow-lg pointer-events-auto whitespace-nowrap"
        >
          📍 Refresh
        </button>
      </div>

      {/* Current Tracking Info */}
      {selectedBusInfo && busLocation && (
        <div className="fixed bottom-24 sm:bottom-20 left-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 sm:p-4 pointer-events-none">
          <div className="text-xs sm:text-sm">
            <div className="font-semibold text-green-600">
              🚌 Tracking: {selectedBusInfo.bus_name}
            </div>
            <div className="text-gray-600">
              {selectedBusInfo.source} → {selectedBusInfo.destination}
            </div>
            <div className="text-gray-500 text-xs">
              Driver: {selectedBusInfo.driver_name} • Last update:{" "}
              {new Date(busLocation.timestamp).toLocaleTimeString()}
            </div>
            {routeData && (
              <div className="text-gray-500 text-xs mt-1">
                Route: {routeData.stops.length} stops • {routeData.distance}km •
                ~{routeData.estimated_time}min
              </div>
            )}
            {nextStop && (
              <div className="text-amber-600 text-xs mt-1">
                Next Stop: {nextStop.stop_name}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bus Selector Modal */}
      {showBusSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Select Active Bus</h3>
              <button
                onClick={() => setShowBusSelector(false)}
                className="text-gray-500 hover:text-gray-700 text-xl p-1"
              >
                ×
              </button>
            </div>

            {activeBuses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🚌</div>
                <div>No buses are currently active</div>
                <div className="text-sm mt-2">
                  Check back later or contact your transport team
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activeBuses.map((bus) => (
                  <button
                    key={bus.bus_id}
                    onClick={() => handleBusSelect(bus.bus_id)}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border transition-colors ${
                      selectedBus === bus.bus_id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm sm:text-base">
                      {bus.bus_name}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      {bus.route_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {bus.source} → {bus.destination}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Driver: {bus.driver_name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setSelectedBus(null);
                  setBusLocation(null);
                  setRouteData(null);
                  setShowBusSelector(false);
                }}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Selection (Show My Location)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Component */}
      <MapComponent
        position={displayPosition}
        busLocation={busLocation}
        userLocation={userPosition}
        selectedBus={selectedBusInfo}
        routeData={routeData}
        currentStopIndex={currentStopIndex}
        getNextStop={getNextStop}
      />
    </div>
  );
};

export default Page;
