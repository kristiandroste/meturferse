# Meturferse v1.0
> Interactive urban planning tool for Turf plots

**Meturferse**, the Turf metaverse, is an open-source, community-driven utility for exploring and visualizing the original Turf plots NFT collection. Built as a love letter to the Turf community, this interactive map provides an immersive way to browse, filter, and analyze Turf plots across the entire Turf City grid.

*Visit the live application at https://www.meturferse.com*


## What is Meturferse?

Meturferse revives the original Turf NFT collection into an interactive 2D metaverse experience. Browse all 5041 unique plots, input wallet addresses to highlight holdings, and explore advanced filtering options based on plot attributes.


## How to Use

1. **Switch Themes**: Choose from 13 visual themes to customize your experience
2. **Browse the Map**: Use mouse/touch to pan and zoom around Turf City
3. **Explore Plots**: Click any plot to view detailed information and high-resolution imagery
4. **Query Wallets**: Enter an Ethereum address to highlight plots owned
5. **Apply Filters**: Use the filter panel to find plots by specific attributes
6. **View Neighborhoods**: With filters selected, click the Neighborhoods button to view each filtered plot's zone of influence


## Understanding Neighborhoods

### Mathematical Definition
Neighborhoods are calculated using a **Manhattan distance-based Voronoi diagram**. Each filtered plot creates an "influence zone" that extends outward until it meets another plot's influence, using city-block distance (horizontal + vertical steps) rather than straight-line distance.

### How It's Calculated
1. **Step 1**: For every empty plot on the grid, calculate Manhattan distance to all filtered plots
2. **Step 2**: Assign each plot to its closest neighbor(s). Plots controlled by single owners get unique colors
3. **Step 3**: "Contested" or "shared" territory (equidistant from multiple plots) gets gray shading with numbers showing how many plots compete for that space

### Visual Legend
- **Colored regions**: Territory controlled by a single filtered plot
- **Gray regions with numbers**: Shared territory, with numbers showing how many filtered plots have equal claim


## Meturferse is a simple vision of distributed utilities built on top of Turf plots.

### Community-Driven Metaverse Architecture
The neighborhood system forms the foundation for a **community-driven metaverse** where Turf becomes a template for distributed virtual worlds. When players hold real stakes through owning tokens and associated infrastructure, and each action relies on a stack of interconnected assets and third-player actions, wealth generation within an in-game economy denominated in ETH directly translates to real-world earnings and appreciation.

**Meturferse** was founded and operates on three core notions, which comprise its vision for the future development:

- **Neighborhoods** delimit economies of scale and provide a mechanism for natural growth of player populations and derivative utilities
- **Plot types** each have a specific purpose and/or set of potential (and potentially open-ended) capabilities, so each plot plays a real part in a diversified in-game economy
- **Wealth generation** in the Meturferse ≈ wealth generation in real life


## Funding & Support

**Help revive Turf and fund this project!**

Donate to: **meturferse.eth** 

Your support helps maintain and improve this community resource. All development is currently volunteer-driven with a focus on benefiting the entire Turf community.


## Community & Contributions

### Get Involved
- **GitHub**: [kristiandroste/meturferse](https://github.com/kristiandroste/meturferse) - Submit issues, feature requests, and contribute code
- **Discord**: [Original Turf Discord](https://discord.gg/jcjTjzDFJj) - Join the community discussion

### Contributing
We welcome contributions from the community! Whether you're a developer, designer, or Turf lover:

1. Check out the GitHub repository for open issues
2. Submit bug reports and feature requests
3. Contribute code improvements and new features
4. Help with documentation and community support
5. Share feedback and ideas for future development

### Community Values
- **Open Source**: All code is publicly available and community-maintainable
- **Benefit All**: Development focused on benefiting all Turf holders and enthusiasts
- **Preserve History**: Maintaining and celebrating the original Turf project legacy
- **Enable Innovation**: Creating tools that enable community creativity and economic activity


## Licensing

### Code License
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

### Image Rights
All plot images are copyright of the original Turf NFT project and/or the respective NFT holders. Meturferse displays these images under fair use for the purpose of providing utility to the Turf community.
The Soba Fett helmet logo and Turf avatar are copyright of Kristian Droste.

### Original Assets Protection
Meturferse is for the benefit of all who love Turf. Efforts may be made to secure the original smart contracts, wallets, codebase, and other assets created by the original Turf team to make them immutable for all eternity.


## Related Links

- **Original Turf Contract**: [0x55d89273143DE3dE00822c9271DbCBD9B44B44C6](https://etherscan.io/address/0x55d89273143DE3dE00822c9271DbCBD9B44B44C6)
- Credit for the original Turf artwork is due [M.T.](https://tseng.co)

---


**Built with ❤️ for the Turf community**

*"I love Turf. You love Turf. We all love Turf."*

Meturferse is a community revival of the original **Turf** plots NFT project, created to preserve, celebrate, and extend the utility of these beloved digital land assets.

---
### ☕ Buy me a coffee → meturferse.eth
