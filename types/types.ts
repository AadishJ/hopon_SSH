export interface Driver {
    driver_id: string
    driver_name: string
    driver_password: string
    bus_id: string | null
    is_on_duty: boolean
    created_at: string
    updated_at: string
}

export interface Bus {
    bus_id: string
    bus_name: string
    route_id: string
    avg_speed: number
    is_active: boolean
    last_updated: string
    created_at: string
}

export interface BusWithRoute extends Bus {
    bus_routes: {
        route_name: string
        source: string
        destination: string
    }
}
export interface BusLocation {
    id: number
    bus_id: string
    latitude: number
    longitude: number
    heading: number | null  
    timestamp: string
    created_at: string
}

export interface BusRoute {
    route_id: string
    route_name: string
    source: string
    destination: string
    stop_sequence: string[]
    distance: number
    estimated_time: number
    is_active: boolean
    created_at?: string
    updated_at?: string
}