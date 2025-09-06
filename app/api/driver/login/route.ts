import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const { driver_id, password } = await request.json()

        if (!driver_id || !password) {
            return NextResponse.json(
                { error: 'Driver ID and password are required' },
                { status: 400 }
            )
        }

        console.log('Attempting login for driver:', driver_id);

        // Fetch driver from database
        const { data: driver, error: driverError } = await supabase
            .from('drivers')
            .select('*')
            .eq('driver_id', driver_id)
            .single()

        console.log('Driver query result:', { driver, driverError });

        if (driverError || !driver) {
            console.log('Driver not found or error:', driverError);
            return NextResponse.json(
                { error: 'Invalid driver ID or password' },
                { status: 401 }
            )
        }

        if (password !== driver.driver_password) {
            console.log('Password mismatch');
            return NextResponse.json(
                { error: 'Invalid driver ID or password' },
                { status: 401 }
            )
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { driver_password, ...driverInfo } = driver

        return NextResponse.json({
            message: 'Login successful',
            driver: driverInfo,
            token: `driver_${driver_id}_${Date.now()}`
        })

    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}