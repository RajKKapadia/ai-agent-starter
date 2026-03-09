import { tool, RunContext } from '@openai/agents';
import { z } from 'zod';

import { UserContext } from './context';
import { appConfig } from '../env';


/**
 * Get current date and time tool
 */
export const currentDateTimeTool = tool({
    name: 'current_date_time',
    description: 'Get the current date and time in the user\'s timezone',
    parameters: z.object({}),
    async execute(_, runContext?: RunContext<UserContext>): Promise<string> {
        const userContext = runContext?.context;

        try {
            const timezone = 'UTC';

            const now = new Date();
            const formatted = now.toLocaleString('en-US', {
                timeZone: timezone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });

            const result = `The current date and time is ${formatted} (${timezone}).`;
            return result;
        } catch (error) {
            throw error;
        }
    },
    async errorFunction(): Promise<string> {
        return `An error occurred while getting the current date and time. Please try again later.`;
    }
});

/**
 * Get current weather information for a location
 */
export const fetchWeatherInformation = tool({
    name: 'get_weather',
    description: 'Get current weather information for a specified city or location',
    parameters: z.object({
        city: z.string().describe('The city name (e.g., "London", "New York", "Tokyo")')
    }),
    async execute({ city }, runContext?: RunContext<UserContext>): Promise<string> {
        try {
            if (!appConfig.OPENWEATHERMAP_API_KEY) {
                return 'Weather service is not configured. Please set OPENWEATHERMAP_API_KEY environment variable.';
            }

            const location = city;
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${appConfig.OPENWEATHERMAP_API_KEY}&units=metric`;

            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return `Could not find weather data for "${city}". Please check the city name and try again.`;
                }
                return `Failed to fetch weather data: ${response.statusText}`;
            }

            const data = await response.json();

            const weather = {
                location: `${data.name}, ${data.sys.country}`,
                temperature: `${data.main.temp}°C (feels like ${data.main.feels_like}°C)`,
                conditions: data.weather[0].description,
                humidity: `${data.main.humidity}%`,
                windSpeed: `${data.wind.speed} m/s`,
                pressure: `${data.main.pressure} hPa`,
            };

            const result = `Weather in ${weather.location}:
- Conditions: ${weather.conditions}
- Temperature: ${weather.temperature}
- Humidity: ${weather.humidity}
- Wind Speed: ${weather.windSpeed}
- Pressure: ${weather.pressure}`;

            return result;
        } catch (error) {
            throw error;
        }
    },
    async errorFunction(): Promise<string> {
        return `An error occurred while fetching weather data. Please try again later.`;
    },
    needsApproval: true
});
