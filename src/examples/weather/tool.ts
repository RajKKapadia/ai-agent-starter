import { tool, RunContext } from '@openai/agents';
import { z } from 'zod';

import { AppContext } from '../../agent/context';
import { getAppConfig } from '../../env';

export const currentDateTimeTool = tool({
    name: 'current_date_time',
    description: 'Get the current date and time in UTC.',
    parameters: z.object({}),
    async execute(_input, _runContext?: RunContext<AppContext>): Promise<string> {
        const formatted = new Date().toLocaleString('en-US', {
            timeZone: 'UTC',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        return `The current date and time is ${formatted} (UTC).`;
    },
    async errorFunction(): Promise<string> {
        return 'An error occurred while getting the current date and time.';
    },
});

export const fetchWeatherInformationTool = tool({
    name: 'get_weather',
    description: 'Get current weather information for a specified city or location.',
    parameters: z.object({
        city: z.string().describe('The city name, for example London or Tokyo.'),
    }),
    async execute({ city }): Promise<string> {
        const config = getAppConfig();
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${config.OPENWEATHERMAP_API_KEY}&units=metric`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                return `Could not find weather data for "${city}".`;
            }

            return `Failed to fetch weather data: ${response.statusText}`;
        }

        const data = await response.json() as {
            name: string;
            sys: { country: string };
            main: { temp: number; feels_like: number; humidity: number; pressure: number };
            weather: Array<{ description: string }>;
            wind: { speed: number };
        };

        return [
            `Weather in ${data.name}, ${data.sys.country}:`,
            `- Conditions: ${data.weather[0]?.description ?? 'Unknown'}`,
            `- Temperature: ${data.main.temp}C (feels like ${data.main.feels_like}C)`,
            `- Humidity: ${data.main.humidity}%`,
            `- Wind Speed: ${data.wind.speed} m/s`,
            `- Pressure: ${data.main.pressure} hPa`,
        ].join('\n');
    },
    async errorFunction(): Promise<string> {
        return 'An error occurred while fetching weather data.';
    },
    needsApproval: true,
});
