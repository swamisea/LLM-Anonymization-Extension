import { TagsInput, Group, Stack, Text, Badge, Divider, Center, Box, SimpleGrid, UnstyledButton, Button, ScrollArea, Tooltip, Accordion, PillGroup, Pill, Image, Indicator, Flex, Switch, TextInput, Textarea, Anchor } from "@mantine/core";
import { useState, useCallback, useEffect } from "react";
import shieldsvg from '/shield.svg';

export default function PIICounter() {
    const [piiData, setPiiData] = useState<Record<string, number>>({});
    const [currCustomPII, setCurrCustomPII] = useState<string[]>([]);
    const [customPII, setCustomPII] = useState<string[]>([]);
    const [llmMode, setLLMMode] = useState<boolean>(false);
    const [llmInstructs, setLLMInstructs] = useState<string[]>([])

    const fetchPIICount = useCallback(() => {
        browser.runtime.sendMessage({ type: 'GET_PII_STATS' })
            .then(setPiiData)
            .catch(console.error);
    }, []);

    const getCustomPII = useCallback(() => {
        browser.runtime.sendMessage({ type: 'GET_CUSTOM_PII' })
            .then((response) => {
                if (response.success && response.customPII) {
                    setCustomPII(Array.from(response.customPII));
                }
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        // Fetch initial data on mount
        fetchPIICount();
        getCustomPII();

        // handler that makes the backend call
        const handleMessage = (message: any) => {
            if (message.type === 'PII_COUNT_UPDATED') {
                fetchPIICount();
            }
        };
        // Add listener for updates from backend for pii counts
        browser.runtime.onMessage.addListener(handleMessage);
    }, [fetchPIICount, getCustomPII]);

    const addCustomPII = useCallback(() => {
        browser.runtime.sendMessage({ type: 'ADD_CUSTOM_PII', customPII: currCustomPII })
            .then(() => {
                console.log("Custom PII added:", currCustomPII);
                setCurrCustomPII([]); // Clear the input field
                getCustomPII(); // Refresh from backend to stay in sync
            })
            .catch(console.error);
    }, [currCustomPII, getCustomPII]);

    const totalCount = Object.values(piiData).reduce((sum, count) => sum + count, 0);

    return (
        <Stack gap="xs" bg="#0f1117" w="100%" h="100%">
            <Group m="sm" justify="space-between">
                <Group gap="xs">
                    <Image
                        src={shieldsvg}
                        w="30"
                        h="30"
                        fit="contain"
                        p="5"
                        radius="md"
                        style={{
                            background: "rgba(34, 201, 132, 0.1)",
                        }}
                    />
                    <Text
                        fw={700}
                        c="#22c984"
                        ff="DM Mono"
                    >
                        PIIShield
                    </Text>
                </Group>
                <Box bg="rgba(34, 201, 132, 0.1)" style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    border: "1px solid rgba(34,201,132,0.25)"
                }}>
                    <Group align="center" gap="3" fz="sm">
                        <Box
                            style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: "#22c984",
                                animation: "pulse 1.5s infinite",
                            }}
                        /><span style={{ color: "#22c984", fontSize: 12 }}>{totalCount}</span> <span style={{ color: "#6b7a96", fontSize: 10 }}>redacted</span>
                        {llmMode && (
                            <Group gap="3">
                                <Box
                                    style={{
                                        width: 3,
                                        height: 3,
                                        borderRadius: "50%",
                                        background: "#22c984"
                                    }}
                                />
                                <Text ff="DM Mono" style={{ color: "#22c984", fontSize: 10 }}>LLM</Text>
                            </Group>
                        )}

                    </Group>
                </Box>
            </Group>
            <Divider color="#252d3d" />
            <Text ff="DM Sans" fz="10" c="#6b7a96" ml="sm" fw="700">DETECTION BREAKDOWN</Text>
            <ScrollArea type="never" mah="125">
                <SimpleGrid ml="xs" mr="xs" mb="xs" cols={2} spacing="xs">
                    {Object.entries(piiData).map(([name, count]) => (
                        <Box
                            key={name}
                            p="sm"
                            style={{
                                borderRadius: '8px',
                                border: '1px solid #252d3d',
                                backgroundColor: '#171B23',
                                transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                            }}
                            className="pii-button"
                        >
                            <Group justify="space-between" wrap="nowrap" c="#e8edf5">
                                <Text ff="DM Sans" size="xs" fw={600} style={{ textTransform: 'capitalize' }}>
                                    {name}
                                </Text>
                                <Badge variant="filled" color="rgba(26,79,214,0.18)" c="#a8c4ff" size="sm" bd="1px solid #a8c4ff">
                                    {count}
                                </Badge>
                            </Group>
                        </Box>
                    ))}
                </SimpleGrid>
            </ScrollArea>
            <Divider ml="md" mr="md" color="#252d3d" />
            <Text ff="DM Sans" fz="10" c="#6b7a96" ml="sm" fw="700">CUSTOM KEYWORDS</Text>
            <Group
                align="center"
                justify="center"
                mb="0"
                m="xs"
                gap="xs"
            >
                <TagsInput
                    ff="DM Mono"
                    c="#6b7a96"
                    style={{ flex: 9 }}
                    styles={{
                        input: {
                            backgroundColor: "#171B23",
                            border: "1.5px solid #252d3d",
                            fontSize: 12,
                            color: "#6b7a96"
                        },
                        pill: {
                            backgroundColor: "#171B23",
                            border: "1.5px solid #252d3d",
                            color: "#6b7a96",
                        }
                    }}
                    value={currCustomPII}
                    onChange={setCurrCustomPII}
                    placeholder="Enter custom keywords here"
                />
                <Button
                    radius="8"
                    bg="#22c984"
                    fz="xs"
                    style={{ flex: 1 }}
                    ff="DM Mono"
                    c="#0f1117"
                    onClick={addCustomPII}
                >
                    Save
                </Button>
            </Group>
            <Group
                gap="xs"
                mt="0"
                ml="xs"
                mr="xs"
            >
                {customPII && (
                    customPII.map((keyword) => (
                        <Pill
                            withRemoveButton
                            bg="rgba(34,201,132,0.12)"
                            bd="1px solid rgba(34,201,132,0.25)"
                            size="sm"
                            c="#22c984"
                        >
                            {keyword}
                        </Pill>
                    ))
                )}
            </Group>
            <Divider ml="md" mr="md" color="#252d3d" />
            <Group justify="space-between" ml="xs" mr="xs">
                <Stack gap="0">
                    <Text ff="DM Sans" fz="10" c="#6b7a96" ml="sm" fw="700">LLM MODE</Text>
                    <Text ff="DM Sans" fz="8" c="#6b7a96" ml="sm" fw="700">Second-pass redaction via custom rule</Text>
                </Stack>
                <Switch
                    checked={llmMode}
                    onChange={(event) => setLLMMode(event.currentTarget.checked)}
                    color="#22c984"
                    withThumbIndicator={false}
                    onLabel="ON"
                    offLabel="OFF"
                />
            </Group>
            {llmMode && (
                <Stack gap="xs"
                    ml="xs"
                    mr="xs">
                    <Textarea
                        styles={{
                            input: {
                                backgroundColor: "#171B23",
                                border: "1.5px solid #252d3d",
                                fontSize: 12,
                                color: "#6b7a96"
                            },
                        }}
                        placeholder="Enter custom keywords here"
                        value={llmInstructs}
                        onChange={(event) => setLLMInstructs([...llmInstructs, event.currentTarget.value])}
                    />
                    <Button
                        ml="lg"
                        mr="lg"
                        size="xs"
                        radius="8"
                        bg="#22c984"
                        fz="xs"
                        ff="DM Mono"
                        c="#0f1117"
                    >
                        Apply Rule
                    </Button>
                </Stack>
            )}

            <Divider color="#252d3d" />
            <Group align="center" gap="xs" fz="sm" justify="center" mb="xs">
                <Box
                    style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "#22c984",
                        animation: "pulse 2s infinite",
                    }}
                /><Text ff="DM Mono" fz="xs" c="#6b7a96"> Issues or feature requests? <Anchor ff="DM Mono" fz="xs" c="#22c984" href="mailto:swaminathanchellappa5@gmail.com" underline="always"> Tell me</Anchor></Text>
            </Group>
        </Stack>

    )
}