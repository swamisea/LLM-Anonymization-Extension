import { Button, Group, Stack, Text, Title, Badge, Divider, ThemeIcon, Paper, Center, Box, SimpleGrid, UnstyledButton } from "@mantine/core";
import { useState, useCallback, useEffect } from "react";
import shieldImg from '@/assets/shield.png';

export default function PIICounter() {
    const [piiData, setPiiData] = useState<Record<string, number>>({});

    const fetchPIICount = useCallback(() => {
        browser.runtime.sendMessage({ type: 'GET_PII_STATS' })
            .then(setPiiData)
            .catch(console.error);
    }, []);

    useEffect(() => {
        // only runs on mount
        fetchPIICount()

        // handler that makes the backend call
        const handleMessage = (message: any) => {
            if (message.type === 'PII_COUNT_UPDATED') {
                fetchPIICount();
            }
        };
        // Add listener for updates from backend for pii counts
        browser.runtime.onMessage.addListener(handleMessage)
    }, [fetchPIICount]);

    const totalCount = Object.values(piiData).reduce((sum, count) => sum + count, 0);

    return (
        <Stack gap="lg">
            <div>
                <Text
                    size="xl"
                    fw={900}
                    variant="gradient"
                    gradient={{ from: 'teal', to: 'green', deg: 90 }}
                    ta="center"
                >
                    PII Dashboard
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                    Track the type and number of PII that have been redacted from your inputs
                </Text>
            </div>

            <Center>
                <Box
                    style={{
                        backgroundImage: `url(${shieldImg})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        width: '60px',
                        height: '70px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                    <Text size="xl" fw={900} c="white" ta="center">
                        {totalCount}
                    </Text>
                </Box>
            </Center>

            <Divider label="Detection Breakdown" labelPosition="center" />

            <SimpleGrid cols={2} spacing="xs">
                {Object.entries(piiData).map(([name, count]) => (
                    <UnstyledButton
                        key={name}
                        p="sm"
                        style={{
                            borderRadius: '8px',
                            border: '1px solid #e9ecef',
                            backgroundColor: '#fff',
                            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                        }}
                        // Add a subtle hover effect to make it feel like a real button
                        className="pii-button"
                    >
                        <Group justify="space-between" wrap="nowrap">
                            <Text size="xs" fw={600} style={{ textTransform: 'capitalize' }}>
                                {name}
                            </Text>
                            <Badge variant="filled" color="blue" size="sm" circle>
                                {count}
                            </Badge>
                        </Group>
                    </UnstyledButton>
                ))}
            </SimpleGrid>
        </Stack>
    )
}