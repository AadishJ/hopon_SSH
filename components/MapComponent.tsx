import React, { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const userIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const busIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="#dc2626" width="40" height="40">
      <rect x="5" y="12" width="30" height="20" rx="3" fill="#dc2626"/>
      <circle cx="12" cy="35" r="3" fill="#374151"/>
      <circle cx="28" cy="35" r="3" fill="#374151"/>
      <rect x="8" y="16" width="6" height="8" fill="white"/>
      <rect x="17" y="16" width="6" height="8" fill="white"/>
      <rect x="26" y="16" width="6" height="8" fill="white"/>
      <rect x="15" y="6" width="10" height="6" rx="2" fill="#dc2626"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const busStopIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#059669" width="24" height="24">
      <circle cx="12" cy="12" r="8" fill="#059669"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
      <rect x="10" y="2" width="4" height="8" fill="#059669"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const nextStopIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#f59e0b" width="32" height="32">
      <circle cx="16" cy="16" r="12" fill="#f59e0b"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
      <rect x="14" y="2" width="4" height="12" fill="#f59e0b"/>
      <polygon points="16,2 20,8 12,8" fill="#f59e0b"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

interface Position {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface BusLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
  heading?: number;
}

interface ActiveBus {
  bus_id: string;
  bus_name: string;
  driver_name: string;
  route_name: string;
  source: string;
  destination: string;
}

interface BusStop {
  stop_id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

interface RouteData {
  route_id: string;
  route_name: string;
  source: string;
  destination: string;
  stop_sequence: string[];
  distance: number;
  estimated_time: number;
  stops: BusStop[];
}

interface MapComponentProps {
  position: Position;
  busLocation?: BusLocation | null;
  userLocation?: Position | null;
  selectedBus?: ActiveBus | null;
  routeData?: RouteData | null;
  currentStopIndex?: number;
  getNextStop?: () => BusStop | null;
}

const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
};

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

const MapComponent: React.FC<MapComponentProps> = ({
  position,
  busLocation,
  userLocation,
  selectedBus,
  routeData,
  currentStopIndex = 0,
}) => {
  const mapRef = useRef<L.Map | null>(null);

  const getMapCenter = (): [number, number] => {
    if (busLocation) {
      return [busLocation.latitude, busLocation.longitude];
    }
    return [position.lat, position.lng];
  };

  const getRouteLineCoordinates = (): [number, number][] => {
    if (!routeData || !routeData.stops) return [];
    return routeData.stops.map((stop) => [stop.latitude, stop.longitude]);
  };

  const nextStop = routeData?.stops?.[currentStopIndex] || null;

  const getNextStopLine = (): [number, number][] => {
    if (!busLocation || !nextStop) return [];
    return [
      [busLocation.latitude, busLocation.longitude],
      [nextStop.latitude, nextStop.longitude],
    ];
  };

  return (
    <div className="h-full">
      <MapContainer
        center={getMapCenter()}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapUpdater center={getMapCenter()} />

        {routeData && routeData.stops && routeData.stops.length > 1 && (
          <Polyline
            positions={getRouteLineCoordinates()}
            pathOptions={{
              color: "#3b82f6",
              weight: 4,
              opacity: 0.7,
              dashArray: "10, 10",
            }}
          />
        )}

        {busLocation && nextStop && (
          <Polyline
            positions={getNextStopLine()}
            pathOptions={{
              color: "#f59e0b",
              weight: 6,
              opacity: 0.9,
              dashArray: "5, 5",
            }}
          />
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
          >
            <Popup>
              <div className="text-center">
                <div className="font-semibold text-blue-600">
                  📍 Your Location
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Lat: {userLocation.lat.toFixed(6)}
                  <br />
                  Lng: {userLocation.lng.toFixed(6)}
                  {userLocation.accuracy && (
                    <>
                      <br />
                      Accuracy: ~{Math.round(userLocation.accuracy)}m
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {routeData &&
          routeData.stops &&
          routeData.stops.map((stop, index) => {
            const isNextStop = index === currentStopIndex;
            const icon = isNextStop ? nextStopIcon : busStopIcon;

            return (
              <Marker
                key={stop.stop_id}
                position={[stop.latitude, stop.longitude]}
                icon={icon}
              >
                <Popup>
                  <div className="text-center min-w-[150px]">
                    <div
                      className={`font-semibold text-lg ${
                        isNextStop ? "text-amber-600" : "text-green-600"
                      }`}
                    >
                      {isNextStop ? "🎯" : "🚏"} {stop.stop_name}
                    </div>
                    {isNextStop && (
                      <div className="text-amber-600 text-sm font-medium mt-1">
                        Next Stop
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      <div>Stop ID: {stop.stop_id}</div>
                      <div>Lat: {stop.latitude.toFixed(6)}</div>
                      <div>Lng: {stop.longitude.toFixed(6)}</div>
                    </div>
                    {busLocation && (
                      <div className="text-xs text-gray-600 mt-1 pt-1 border-t">
                        Distance from bus:{" "}
                        {Math.round(
                          calculateDistance(
                            busLocation.latitude,
                            busLocation.longitude,
                            stop.latitude,
                            stop.longitude
                          )
                        )}
                        m
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {busLocation && selectedBus && (
          <Marker
            position={[busLocation.latitude, busLocation.longitude]}
            icon={busIcon}
          >
            <Popup>
              <div className="text-center min-w-[200px]">
                <div className="font-semibold text-red-600 text-lg">
                  🚌 {selectedBus.bus_name}
                </div>
                <div className="text-sm text-gray-700 mt-2">
                  <div className="font-medium">{selectedBus.route_name}</div>
                  <div className="text-xs text-gray-600">
                    {selectedBus.source} → {selectedBus.destination}
                  </div>
                </div>
                <div className="text-xs text-green-600 mt-2">
                  Driver: {selectedBus.driver_name}
                </div>
                {nextStop && (
                  <div className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded">
                    <strong>Next Stop:</strong>
                    <br />
                    {nextStop.stop_name}
                    <br />
                    {Math.round(
                      calculateDistance(
                        busLocation.latitude,
                        busLocation.longitude,
                        nextStop.latitude,
                        nextStop.longitude
                      )
                    )}
                    m away
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1 pt-2 border-t">
                  <div>Lat: {busLocation.latitude.toFixed(6)}</div>
                  <div>Lng: {busLocation.longitude.toFixed(6)}</div>
                  {busLocation.heading && (
                    <div>Heading: {busLocation.heading.toFixed(0)}°</div>
                  )}
                  <div>
                    Updated:{" "}
                    {new Date(busLocation.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {!busLocation && (
          <Marker position={[position.lat, position.lng]} icon={userIcon}>
            <Popup>
              <div className="text-center">
                <div className="font-semibold text-blue-600">
                  📍 Your Location
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Lat: {position.lat.toFixed(6)}
                  <br />
                  Lng: {position.lng.toFixed(6)}
                  {position.accuracy && (
                    <>
                      <br />
                      Accuracy: ~{Math.round(position.accuracy)}m
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                  Select a bus above to track it live!
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
