// Create a progress graph for XP transactions
export const createProgressGraph = (transactions, totalXp) => {
    // Calculate height increments based on total XP
    const graphHeightIncrements = Math.round(totalXp / 100000) * 10 || 10;

    // Convert transaction dates to Date objects and determine earliest and latest dates
    const dates = transactions.map(transaction => new Date(transaction.createdAt));
    const earliestTime = new Date(Math.min(...dates));
    const latestTime = new Date(Math.max(...dates));
    const timeDiff = latestTime - earliestTime; // Difference in time
    const dayDiff = Math.ceil(timeDiff / 1000 / 60 / 60 / 24); // Difference in days

    // Update the date range display on the page
    const timeRange = document.getElementById("dateInfo");
    timeRange.textContent = `(${earliestTime.toString().slice(4, 15)} - ${latestTime.toString().slice(4, 15)})`;

    // Adjust the end and start dates for better visualization if the time range is large
    if (dayDiff > 30 && latestTime.getDate() !== 1) {
        latestTime.setMonth(latestTime.getMonth() + 1);
        latestTime.setDate(1);
    } else {
        latestTime.setDate(latestTime.getDate() + 1);
        latestTime.setHours(0, 0, 0, 0);
    }

    if (dayDiff > 30 && earliestTime.getDate() !== 1) {
        earliestTime.setDate(1);
    } else {
        earliestTime.setHours(0, 0, 0, 0);
    }

    // Add a starting data point for zero XP to ensure graph starts from zero
    transactions.unshift({ amount: 0, createdAt: Math.min(...dates) });

    // Set up graph dimensions and scales
    const graphWidth = 800;
    const graphHeight = 400; 
    const xPadding = 50;
    const yPadding = 50;

    const initialTotalXp = totalXp / 1000;
    let cumulativeXp = 0;
    const xScale = (graphWidth - 2 * xPadding) / (latestTime - earliestTime);
    const yScale = (graphHeight - 2 * yPadding) / initialTotalXp;

    // Map transactions to graph data
    const graphData = transactions.map(transaction => {
        cumulativeXp += transaction.amount / 1000;
        return {
            x: (new Date(transaction.createdAt) - earliestTime) * xScale + xPadding,
            y: (graphHeight - yPadding) - (cumulativeXp * yScale),
            title: transaction.path,
        };
    });

    // Create SVG element for the graph
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${graphWidth} ${graphHeight}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // Draw horizontal grid lines and labels
    const horizontalLineDistance = graphHeight / (graphHeightIncrements * yScale);
    const horizontalLineIncrement = graphHeight / horizontalLineDistance;

    for (let i = 0; i < horizontalLineDistance; i++) {
        const y = graphHeight - yPadding - i * horizontalLineIncrement;

        const line = document.createElementNS(svgNamespace, "line");
        line.setAttribute("x1", xPadding);
        line.setAttribute("y1", y);
        line.setAttribute("x2", graphWidth - xPadding);
        line.setAttribute("y2", y);
        line.setAttribute("stroke", "#444444");
        line.setAttribute("stroke-width", "0.5px");
        svg.appendChild(line);

        const text = document.createElementNS(svgNamespace, "text");
        text.setAttribute("x", 0);
        text.setAttribute("y", y + 3);
        text.setAttribute("fill", "black");
        text.setAttribute("font-size", "10");
        text.textContent = i * graphHeightIncrements + " kB";
        svg.appendChild(text);
    }

    // Map for month abbreviations
    const monthMap = new Map([
        [0, "Jan"],
        [1, "Feb"],
        [2, "Mar"],
        [3, "Apr"],
        [4, "May"],
        [5, "Jun"],
        [6, "Jul"],
        [7, "Aug"],
        [8, "Sep"],
        [9, "Oct"],
        [10, "Nov"],
        [11, "Dec"],
    ]);

    // Determine the interval for vertical grid lines based on the time range
    let bigTimeInterval = false;
    let monthsDifference = calculateMonths(earliestTime, latestTime);

    if (monthsDifference >= 12) {
        bigTimeInterval = true;
        for (let i = monthsDifference; i % 3 !== 0; i++) {
            latestTime.setMonth(latestTime.getMonth() + 1);
            monthsDifference++;
        }
        monthsDifference /= 3;
    }

    const tDiff = dayDiff > 30 ? monthsDifference : dayDiff;
    const verticalLineIncrement = (graphWidth - 2 * xPadding) / tDiff;

    let startMonth = earliestTime.getMonth();
    let startYear = earliestTime.getFullYear().toString().slice(2);

    // Draw vertical grid lines and labels
    for (let i = 0; i <= tDiff; i++) {
        if (startMonth >= 12) {
            startMonth -= 12;
            startYear++;
        }
        const x = i * verticalLineIncrement + xPadding;

        const line = document.createElementNS(svgNamespace, "line");
        line.setAttribute("x1", x);
        line.setAttribute("y1", yPadding);
        line.setAttribute("x2", x);
        line.setAttribute("y2", graphHeight - yPadding);
        line.setAttribute("stroke", "#444444");
        line.setAttribute("stroke-width", "0.5px");
        svg.appendChild(line);

        if (i < tDiff) {
            const text = document.createElementNS(svgNamespace, "text");
            text.setAttribute("x", x);
            text.setAttribute("y", graphHeight - yPadding + 15);
            text.setAttribute("fill", "black");
            text.setAttribute("font-size", "10");
            if (dayDiff > 30) {
                text.textContent = `${monthMap.get(startMonth)} ${startYear}`;
                bigTimeInterval ? (startMonth += 3) : startMonth++;
            } else {
                let day = earliestTime.getDate() + i;
                let month = earliestTime.getMonth() + 1;
                let maxDay = new Date(earliestTime.getFullYear(), month, 0).getDate();
                text.textContent = `${day > maxDay ? day - maxDay : day}`;
            }
            svg.appendChild(text);
        }
    }

    // Draw the graph lines
    for (let i = 1; i < graphData.length; i++) {
        const line = document.createElementNS(svgNamespace, "line");
        line.setAttribute("x1", graphData[i - 1].x);
        line.setAttribute("y1", graphData[i - 1].y);
        line.setAttribute("x2", graphData[i].x);
        line.setAttribute("y2", graphData[i].y);
        line.setAttribute("stroke", "#3a7bd5");
        svg.appendChild(line);
    }

    // Draw data points
    for (const data of graphData) {
        const circle = document.createElementNS(svgNamespace, "circle");
        circle.setAttribute("cx", data.x);
        circle.setAttribute("cy", data.y);
        circle.setAttribute("r", "3");
        circle.setAttribute("fill", "#3a7bd5");
        if (data.title) {
            const title = document.createElementNS(svgNamespace, "title");
            title.textContent = data.title.replace("/johvi/", "");
            circle.appendChild(title);
        }
        svg.appendChild(circle);
    }

    // Append the SVG graph to the chart container
    const chartContainer = document.getElementById("chart");
    chartContainer.innerHTML = "";
    chartContainer.appendChild(svg);
};

// Utility function to calculate the number of months between two dates
const calculateMonths = (startDateStr, endDateStr) => {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    return (
        endDate.getMonth() -
        startDate.getMonth() +
        12 * (endDate.getFullYear() - startDate.getFullYear())
    );
};

// Create a bar graph showing XP by project
export const createXpByProjectGraph = (data) => {
    const barGraph = document.getElementById("xpGraph");
    barGraph.innerHTML = "";

    const barHeight = 20;
    const barGap = 10;
    const barWidth = 300;

    // Calculate graph height based on data length
    const graphHeight = (barHeight + barGap) * (data.length + 1);
    barGraph.setAttribute("height", graphHeight);

    const maxValue = Math.max(...data.map(item => item.amount));
    const xPadding = 10;

    // Create bars for each data item
    data.forEach((item, index) => {
        const barLength = (item.amount / maxValue) * barWidth;
        const bar = createSvgElement("rect", { x: xPadding, y: (index + 1) * (barHeight + barGap), width: barLength, height: barHeight, fill: "#d47264", style: `--bar-width: ${barLength}px; animation: grow 1s ease-out forwards;` });
        const pathText = createSvgElement("text", { x: barWidth + xPadding + 10, y: (index + 1) * (barHeight + barGap) + barHeight / 2, "dominant-baseline": "middle", fill: "black", "text-anchor": "start" });
        pathText.textContent = item.path;
        const amountText = createSvgElement("text", { x: xPadding + 5, y: (index + 1) * (barHeight + barGap) + barHeight / 2, "dominant-baseline": "middle", fill: "black" });
        amountText.textContent = (item.amount / 1000).toFixed(1) + " kB";

        barGraph.appendChild(bar);
        barGraph.appendChild(pathText);
        barGraph.appendChild(amountText);
    });
};

// Create a bar graph showing audit details
export const createAuditDetailsGraph = (data) => {
    const auditGraph = document.getElementById("auditGraph");
    auditGraph.innerHTML = "";

    const barHeight = 20;
    const barGap = 10;
    const barWidth = 300;

    // Calculate graph height based on data length
    const graphHeight = (barHeight + barGap) * (data.length + 1);
    auditGraph.setAttribute("height", graphHeight);

    const maxValue = Math.max(...data.map(item => item.amount));
    const xPadding = 10;

    // Create bars for each data item
    data.forEach((item, index) => {
        const barLength = (item.amount / maxValue) * barWidth;
        const bar = createSvgElement("rect", { x: xPadding, y: (index + 1) * (barHeight + barGap), width: barLength, height: barHeight, fill: "#d47264", style: `--bar-width: ${barLength}px; animation: grow 1s ease-out forwards;` });
        const pathText = createSvgElement("text", { x: barWidth + xPadding + 10, y: (index + 1) * (barHeight + barGap) + barHeight / 2, "dominant-baseline": "middle", fill: "black", "text-anchor": "start" });
        pathText.textContent = item.path;
        const amountText = createSvgElement("text", { x: xPadding + 5, y: (index + 1) * (barHeight + barGap) + barHeight / 2, "dominant-baseline": "middle", fill: "black" });
        amountText.textContent = (item.amount / 1000).toFixed(1) + " kB";

        auditGraph.appendChild(bar);
        auditGraph.appendChild(pathText);
        auditGraph.appendChild(amountText);
    });
};

// Utility function to create SVG elements
const createSvgElement = (type, attributes) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", type);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    return element;
};
